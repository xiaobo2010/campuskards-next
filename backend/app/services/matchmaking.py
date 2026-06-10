"""Matchmaking — Redis-backed queues with in-memory cache per worker."""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal

from app.core.cache import (
    cache_delete,
    cache_get,
    cache_scan_keys,
    cache_set,
    distributed_lock,
)
from app.services.pve_bot import BOT_DECK_ID, BOT_USER_ID, BOT_USERNAME

MatchMode = Literal["quick", "ranked", "pve", "story"]
VALID_MODES: tuple[MatchMode, ...] = ("quick", "ranked", "pve", "story")
QUEUE_MODES: tuple[MatchMode, ...] = ("quick", "ranked")

QUEUE_KEY_TEMPLATE = "match:queue:{mode}"
QUEUE_LOCK_TEMPLATE = "match:lock:queue:{mode}"
USER_STATE_KEY = "match:user:"
MATCH_USER_KEY = "match:active:"
ELO_RANGE = 200
ESTIMATED_WAIT_MS = 15000
BOT_WAIT_SECONDS = 60


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
    """Shared matchmaking via Redis; local dict mirrors for fast reads on this worker."""

    def __init__(self) -> None:
        self._queues: dict[MatchMode, list[QueueEntry]] = {m: [] for m in VALID_MODES}
        self._user_queue_mode: dict[str, MatchMode] = {}
        self._user_active_match: dict[str, str] = {}
        self._lock = asyncio.Lock()
        self._bot_match_callback: Callable[[MatchTicket], Awaitable[None]] | None = None
        self._bot_fill_task: asyncio.Task | None = None

    async def enqueue(self, entry: QueueEntry) -> tuple[int, MatchTicket | None]:
        if entry.mode not in VALID_MODES:
            raise ValueError("invalid_mode")
        if entry.mode == "pve":
            raise ValueError("use_pve_endpoint")

        async with self._lock:
            lock_key = QUEUE_LOCK_TEMPLATE.format(mode=entry.mode)
            async with distributed_lock(lock_key, ttl_sec=8.0, wait_sec=5.0) as acquired:
                if not acquired:
                    raise ValueError("queue_busy")

                if await cache_get(f"{MATCH_USER_KEY}{entry.user_id}"):
                    raise ValueError("already_in_match")

                queue = await self._load_queue(entry.mode)
                if any(e.user_id == entry.user_id for e in queue):
                    raise ValueError("already_queued")

                queue.append(entry)
                queue.sort(key=lambda e: e.joined_at)
                self._queues[entry.mode] = queue
                self._user_queue_mode[entry.user_id] = entry.mode

                ticket = self._try_match_locked(entry.mode)
                await self._save_queue(entry.mode)

                if ticket:
                    await self._register_active_match(ticket)
                else:
                    await self._sync_user_state(
                        entry.user_id,
                        {"status": "queued", "mode": entry.mode},
                    )

                position = self._position_locked(entry.user_id, entry.mode)
                return position, ticket

    async def dequeue(self, user_id: str, mode: MatchMode | None = None) -> bool:
        async with self._lock:
            target_mode = mode or self._user_queue_mode.get(user_id)
            if not target_mode or target_mode not in QUEUE_MODES:
                raw = await cache_get(f"{USER_STATE_KEY}{user_id}")
                if raw:
                    try:
                        data = json.loads(raw)
                        if data.get("status") == "queued":
                            target_mode = data.get("mode")
                    except json.JSONDecodeError:
                        pass
            if not target_mode or target_mode not in QUEUE_MODES:
                return False

            lock_key = QUEUE_LOCK_TEMPLATE.format(mode=target_mode)
            acquired = False
            try:
                async with distributed_lock(lock_key, ttl_sec=8.0, wait_sec=5.0) as ok:
                    acquired = ok
                    if not acquired:
                        # Lock contention — try force-remove from queue directly
                        queue = await self._load_queue(target_mode)
                        before = len(queue)
                        queue = [e for e in queue if e.user_id != user_id]
                        removed = len(queue) < before
                        if removed:
                            self._queues[target_mode] = queue
                            self._user_queue_mode.pop(user_id, None)
                            await self._save_queue(target_mode)
                            await cache_delete(f"{USER_STATE_KEY}{user_id}")
                        return removed
                    return await self._dequeue_locked(user_id, target_mode)
            except Exception:
                if not acquired:
                    # Fallback: force-remove without lock as last resort
                    queue = await self._load_queue(target_mode)
                    before = len(queue)
                    queue = [e for e in queue if e.user_id != user_id]
                    if len(queue) < before:
                        self._queues[target_mode] = queue
                        self._user_queue_mode.pop(user_id, None)
                        await self._save_queue(target_mode)
                        await cache_delete(f"{USER_STATE_KEY}{user_id}")
                        return True
                return False

    async def _dequeue_locked(self, user_id: str, target_mode: MatchMode) -> bool:
        queue = await self._load_queue(target_mode)
        before = len(queue)
        queue = [e for e in queue if e.user_id != user_id]
        removed = len(queue) < before
        if removed:
            self._queues[target_mode] = queue
            self._user_queue_mode.pop(user_id, None)
            await self._save_queue(target_mode)
            await cache_delete(f"{USER_STATE_KEY}{user_id}")
        return removed

    async def get_status(self, user_id: str) -> dict[str, Any]:
        # Active match: Redis is authoritative across workers
        active = await cache_get(f"{MATCH_USER_KEY}{user_id}")
        if active:
            mode = await self._resolve_user_mode(user_id)
            self._user_active_match[user_id] = active
            return {
                "status": "matched",
                "match_id": active,
                "mode": mode,
                "opponent": None,
            }

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
                "queue_position": await self._queue_position(user_id, mode),
                "estimated_wait": ESTIMATED_WAIT_MS,
            }

        # Cross-worker queue lookup
        for qmode in QUEUE_MODES:
            position = await self._queue_position(user_id, qmode)
            if position > 0:
                self._user_queue_mode[user_id] = qmode
                return {
                    "status": "queued",
                    "mode": qmode,
                    "queue_position": position,
                    "estimated_wait": ESTIMATED_WAIT_MS,
                }

        return {"status": "idle"}

    async def register_active_match(self, ticket: MatchTicket) -> None:
        await self._register_active_match(ticket)

    async def _register_active_match(self, ticket: MatchTicket) -> None:
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

    async def _queue_position(self, user_id: str, mode: MatchMode) -> int:
        queue = await self._load_queue(mode)
        for idx, entry in enumerate(queue):
            if entry.user_id == user_id:
                return idx + 1
        return 0

    async def _load_queue(self, mode: MatchMode) -> list[QueueEntry]:
        raw = await cache_get(QUEUE_KEY_TEMPLATE.format(mode=mode))
        if not raw:
            self._queues[mode] = []
            return []

        try:
            items = json.loads(raw)
        except json.JSONDecodeError:
            self._queues[mode] = []
            return []

        restored: list[QueueEntry] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            uid = item.get("user_id")
            if not uid:
                continue
            if await cache_get(f"{MATCH_USER_KEY}{uid}"):
                continue
            restored.append(
                QueueEntry(
                    user_id=uid,
                    username=item.get("username", "player"),
                    elo=int(item.get("elo", 1000)),
                    deck_id=item.get("deck_id", ""),
                    mode=mode,
                    joined_at=float(item.get("joined_at", time.time())),
                )
            )
        restored.sort(key=lambda e: e.joined_at)
        self._queues[mode] = restored
        for entry in restored:
            self._user_queue_mode[entry.user_id] = mode
        return restored

    async def _save_queue(self, mode: MatchMode) -> None:
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
        """Warm local caches from Redis on worker startup."""
        async with self._lock:
            for mode in QUEUE_MODES:
                await self._load_queue(mode)

            keys = await cache_scan_keys(f"{MATCH_USER_KEY}*")
            for key in keys:
                user_id = key.removeprefix(MATCH_USER_KEY)
                match_id = await cache_get(key)
                if user_id and match_id:
                    self._user_active_match[user_id] = match_id

    def set_bot_match_callback(
        self, callback: Callable[[MatchTicket], Awaitable[None]] | None
    ) -> None:
        self._bot_match_callback = callback

    def start_bot_fill(self) -> None:
        if self._bot_fill_task is None:
            self._bot_fill_task = asyncio.create_task(self._bot_fill_loop())

    def stop_bot_fill(self) -> None:
        if self._bot_fill_task:
            self._bot_fill_task.cancel()
            self._bot_fill_task = None

    async def _bot_fill_loop(self) -> None:
        while True:
            await asyncio.sleep(BOT_WAIT_SECONDS)
            try:
                await self._try_bot_fill()
            except Exception:
                pass

    async def _try_bot_fill(self) -> None:
        for mode in ("quick",):
            lock_key = QUEUE_LOCK_TEMPLATE.format(mode=mode)
            async with distributed_lock(lock_key, ttl_sec=8.0, wait_sec=2.0) as acquired:
                if not acquired:
                    continue

                queue = await self._load_queue(mode)
                if len(queue) != 1:
                    continue

                entry = queue[0]
                if time.time() - entry.joined_at < BOT_WAIT_SECONDS:
                    continue

                ticket = MatchTicket(
                    match_id=str(uuid.uuid4()),
                    mode=mode,
                    p1_id=entry.user_id,
                    p1_username=entry.username,
                    p1_elo=entry.elo,
                    p1_deck_id=entry.deck_id,
                    p2_id=str(BOT_USER_ID),
                    p2_username=BOT_USERNAME,
                    p2_elo=entry.elo,
                    p2_deck_id=str(BOT_DECK_ID),
                )

                self._queues[mode] = []
                self._user_queue_mode.pop(entry.user_id, None)
                await self._save_queue(mode)
                await self._register_active_match(ticket)

                if self._bot_match_callback:
                    asyncio.create_task(self._bot_match_callback(ticket))


matchmaking = MatchmakingService()
