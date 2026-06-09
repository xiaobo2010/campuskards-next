"""Matchmaking — separate quick / ranked queues with Redis mirror."""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

from app.core.cache import cache_delete, cache_get, cache_set

MatchMode = Literal["quick", "ranked", "pve"]
VALID_MODES: tuple[MatchMode, ...] = ("quick", "ranked", "pve")

QUEUE_KEY_TEMPLATE = "match:queue:{mode}"
USER_STATE_KEY = "match:user:"
MATCH_USER_KEY = "match:active:"
ELO_RANGE = 200
ESTIMATED_WAIT_MS = 15000


@dataclass
class QueueEntry:
    user_id: str
    username: str
    elo: int
    deck_id: str
    mode: MatchMode
    joined_at: float = field(default_factory=time.time)


@dataclass
class MatchTicket:
    match_id: str
    mode: MatchMode
    p1_id: str
    p1_username: str
    p1_elo: int
    p1_deck_id: str
    p2_id: str
    p2_username: str
    p2_elo: int
    p2_deck_id: str
    created_at: float = field(default_factory=time.time)


class MatchmakingService:
    """Per-mode matchmaking queues; Redis mirror when available."""

    def __init__(self) -> None:
        self._queues: dict[MatchMode, list[QueueEntry]] = {m: [] for m in VALID_MODES}
        self._user_queue_mode: dict[str, MatchMode] = {}
        self._user_active_match: dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def enqueue(self, entry: QueueEntry) -> tuple[int, MatchTicket | None]:
        if entry.mode not in VALID_MODES:
            raise ValueError("invalid_mode")
        if entry.mode == "pve":
            raise ValueError("use_pve_endpoint")

        async with self._lock:
            if entry.user_id in self._user_active_match:
                raise ValueError("already_in_match")
            if entry.user_id in self._user_queue_mode:
                raise ValueError("already_queued")

            queue = self._queues[entry.mode]
            queue.append(entry)
            queue.sort(key=lambda e: e.joined_at)
            self._user_queue_mode[entry.user_id] = entry.mode

            ticket = self._try_match_locked(entry.mode)
            position = self._position_locked(entry.user_id, entry.mode)
            await self._sync_redis(entry.mode)
            await self._sync_user_state(entry.user_id, {"status": "queued", "mode": entry.mode})
            return position, ticket

    async def dequeue(self, user_id: str, mode: MatchMode | None = None) -> bool:
        async with self._lock:
            target_mode = mode or self._user_queue_mode.get(user_id)
            if not target_mode:
                return False

            queue = self._queues[target_mode]
            before = len(queue)
            self._queues[target_mode] = [e for e in queue if e.user_id != user_id]
            removed = len(self._queues[target_mode]) < before
            if removed:
                self._user_queue_mode.pop(user_id, None)
                await self._sync_redis(target_mode)
                await cache_delete(f"{USER_STATE_KEY}{user_id}")
            return removed

    async def get_status(self, user_id: str) -> dict[str, Any]:
        async with self._lock:
            if user_id in self._user_active_match:
                match_id = self._user_active_match[user_id]
                mode = await self._resolve_user_mode(user_id)
                return {
                    "status": "matched",
                    "match_id": match_id,
                    "mode": mode,
                    "opponent": None,
                }

            mode = self._user_queue_mode.get(user_id)
            if mode:
                return {
                    "status": "queued",
                    "mode": mode,
                    "queue_position": self._position_locked(user_id, mode),
                    "estimated_wait": ESTIMATED_WAIT_MS,
                }

        # Cross-worker fallback via Redis mirror
        active = await cache_get(f"{MATCH_USER_KEY}{user_id}")
        if active:
            mode = await self._resolve_user_mode(user_id)
            return {
                "status": "matched",
                "match_id": active,
                "mode": mode,
                "opponent": None,
            }
        return {"status": "idle"}

    async def register_active_match(self, ticket: MatchTicket) -> None:
        async with self._lock:
            self._user_active_match[ticket.p1_id] = ticket.match_id
            self._user_active_match[ticket.p2_id] = ticket.match_id
            self._user_queue_mode.pop(ticket.p1_id, None)
            self._user_queue_mode.pop(ticket.p2_id, None)

            for uid in (ticket.p1_id, ticket.p2_id):
                await cache_set(f"{MATCH_USER_KEY}{uid}", ticket.match_id, ttl=3600)
                await self._sync_user_state(
                    uid,
                    {"status": "matched", "match_id": ticket.match_id, "mode": ticket.mode},
                )

    async def clear_active_match(self, user_id: str) -> None:
        async with self._lock:
            self._user_active_match.pop(user_id, None)
            await cache_delete(f"{MATCH_USER_KEY}{user_id}")
            await cache_delete(f"{USER_STATE_KEY}{user_id}")

    def _try_match_locked(self, mode: MatchMode) -> MatchTicket | None:
        queue = self._queues[mode]
        if len(queue) < 2:
            return None

        for i, a in enumerate(queue):
            for j in range(i + 1, len(queue)):
                b = queue[j]
                if abs(a.elo - b.elo) <= ELO_RANGE:
                    self._queues[mode].pop(j)
                    self._queues[mode].pop(i)
                    self._user_queue_mode.pop(a.user_id, None)
                    self._user_queue_mode.pop(b.user_id, None)
                    return MatchTicket(
                        match_id=str(uuid.uuid4()),
                        mode=mode,
                        p1_id=a.user_id,
                        p1_username=a.username,
                        p1_elo=a.elo,
                        p1_deck_id=a.deck_id,
                        p2_id=b.user_id,
                        p2_username=b.username,
                        p2_elo=b.elo,
                        p2_deck_id=b.deck_id,
                    )
        return None

    def _position_locked(self, user_id: str, mode: MatchMode) -> int:
        for idx, entry in enumerate(self._queues[mode]):
            if entry.user_id == user_id:
                return idx + 1
        return 0

    async def _sync_redis(self, mode: MatchMode) -> None:
        payload = json.dumps(
            [
                {
                    "user_id": e.user_id,
                    "username": e.username,
                    "elo": e.elo,
                    "deck_id": e.deck_id,
                    "mode": e.mode,
                    "joined_at": e.joined_at,
                }
                for e in self._queues[mode]
            ]
        )
        await cache_set(QUEUE_KEY_TEMPLATE.format(mode=mode), payload, ttl=600)

    async def _sync_user_state(self, user_id: str, state: dict[str, Any]) -> None:
        await cache_set(f"{USER_STATE_KEY}{user_id}", json.dumps(state), ttl=3600)

    async def _resolve_user_mode(self, user_id: str) -> MatchMode | None:
        raw = await cache_get(f"{USER_STATE_KEY}{user_id}")
        if raw:
            try:
                data = json.loads(raw)
                mode = data.get("mode")
                if mode in VALID_MODES:
                    return mode
            except json.JSONDecodeError:
                pass
        return None

    async def hydrate_from_redis(self) -> None:
        """Restore queue mirrors from Redis after worker restart (best-effort)."""
        async with self._lock:
            for mode in ("quick", "ranked"):
                raw = await cache_get(QUEUE_KEY_TEMPLATE.format(mode=mode))
                if not raw:
                    continue
                try:
                    entries = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                restored: list[QueueEntry] = []
                for item in entries:
                    if not isinstance(item, dict):
                        continue
                    uid = item.get("user_id")
                    if not uid or uid in self._user_active_match:
                        continue
                    restored.append(
                        QueueEntry(
                            user_id=uid,
                            username=item.get("username", "player"),
                            elo=int(item.get("elo", 1000)),
                            deck_id=item.get("deck_id", ""),
                            mode=mode,  # type: ignore[arg-type]
                            joined_at=float(item.get("joined_at", time.time())),
                        )
                    )
                if restored:
                    self._queues[mode] = restored
                    for entry in restored:
                        self._user_queue_mode[entry.user_id] = mode


matchmaking = MatchmakingService()
