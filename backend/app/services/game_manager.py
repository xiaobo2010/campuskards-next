"""Active game rooms — in-memory WebSocket fan-out + Redis state persistence."""
from __future__ import annotations

import asyncio
import logging
import time
import uuid

logger = logging.getLogger(__name__)
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_set_nx
from app.core.database import async_session
from app.core.game_engine import GameError, GameState, Phase, create_game, is_unit_card
from app.core.game_protocol import (
    TIMER_WARNING_SECONDS,
    TURN_TIMER_SECONDS,
    build_battle_report,
    build_game_state,
    player_key,
)
from app.models import Card, Deck, DeckCard, Match, User
from app.services.battle_rewards import apply_battle_rewards
from app.services.elo import calculate_elo_changes
from app.services.game_state_store import (
    claim_room_owner,
    delete_room,
    hydrate_game_from_data,
    is_room_owner,
    load_room_data,
    register_presence,
    save_room,
    timer_lock_key,
    unregister_presence,
)
from app.services.leaderboard_cache import invalidate_leaderboard_cache
from app.services.match_events_bus import (
    ROOM_CREATED_EVENT,
    STATE_REFRESH_EVENT,
    get_worker_id,
    publish_match_event,
    publish_room_created,
    start_match_events_bus,
    stop_match_events_bus,
)
from app.services.matchmaking import MatchMode, MatchTicket, matchmaking
from app.services.pve_ai import BotAction, decide_bot_actions
from app.services.pve_bot import is_bot_user


@dataclass
class GameRoom:
    match_id: str
    mode: MatchMode
    game: GameState
    p1_id: str
    p2_id: str
    p1_username: str
    p2_username: str
    p1_deck_id: str
    p2_deck_id: str
    p1_faction: str | None = None
    p2_faction: str | None = None
    bot_difficulty: str | None = None
    connections: dict[str, WebSocket] = field(default_factory=dict)
    joined: set[str] = field(default_factory=set)
    elo_changes: dict[str, int] = field(default_factory=dict)
    match_started_at: float = field(default_factory=time.time)
    turn_deadline: float | None = None
    _timer_generation: int = 0
    _warning_sent: bool = False
    _finalized: bool = False
    _version: int = 0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def player_slot(self, user_id: str) -> int | None:
        if user_id == self.p1_id:
            return 1
        if user_id == self.p2_id:
            return 2
        return None

    def opponent_id(self, user_id: str) -> str | None:
        if user_id == self.p1_id:
            return self.p2_id
        if user_id == self.p2_id:
            return self.p1_id
        return None


class GameManager:
    def __init__(self) -> None:
        self._rooms: dict[str, GameRoom] = {}
        self._lock = asyncio.Lock()
        self._bus_started = False

    async def start(self) -> None:
        if self._bus_started:
            return
        await start_match_events_bus(self._on_remote_event)
        await matchmaking.hydrate_from_redis()
        self._bus_started = True

    async def stop(self) -> None:
        await stop_match_events_bus()
        self._bus_started = False

    async def _on_remote_event(
        self,
        match_id: str,
        event: str,
        payload: dict[str, Any],
        _origin: str,
    ) -> None:
        room = await self.get_room(match_id, prefer_redis=True)
        if not room:
            return

        if event in (STATE_REFRESH_EVENT, ROOM_CREATED_EVENT):
            await self._sync_room_from_redis(room)
            await self._broadcast_states_local(room)
            if room.connections and room.turn_deadline and not room.game.game_over:
                await self._schedule_turn_timer(room)
            return

        await self._sync_room_from_redis(room)
        await self._broadcast_local(room, event, payload)

    async def create_room(
        self,
        ticket: MatchTicket,
        p1_cards: list[dict],
        p2_cards: list[dict],
        *,
        p1_starting_hp: int = 30,
        p2_starting_hp: int = 30,
        p1_max_ink: int = 10,
        p2_max_ink: int = 10,
        bot_difficulty: str | None = None,
    ) -> GameRoom:
        max_cap = max(p1_max_ink, p2_max_ink, 10)
        game = create_game(
            p1_cards,
            p2_cards,
            p1_starting_hp=p1_starting_hp,
            p2_starting_hp=p2_starting_hp,
            max_ink_cap=max_cap,
        )
        game.battlefield.player1.max_ink = min(game.battlefield.player1.max_ink, p1_max_ink)
        game.battlefield.player2.max_ink = min(game.battlefield.player2.max_ink, p2_max_ink)
        room = GameRoom(
            match_id=ticket.match_id,
            mode=ticket.mode,
            game=game,
            p1_id=ticket.p1_id,
            p2_id=ticket.p2_id,
            p1_username=ticket.p1_username,
            p2_username=ticket.p2_username,
            p1_deck_id=ticket.p1_deck_id,
            p2_deck_id=ticket.p2_deck_id,
            bot_difficulty=bot_difficulty,
        )
        async with self._lock:
            self._rooms[ticket.match_id] = room
        await save_room(room)
        await claim_room_owner(ticket.match_id)
        await publish_room_created(ticket.match_id)
        await matchmaking.register_active_match(ticket)
        return room

    async def _sync_room_from_redis(self, room: GameRoom) -> bool:
        """Merge newer Redis state into the local room (keeps WS connections)."""
        data = await load_room_data(room.match_id)
        if not data:
            return False
        remote_ver = int(data.get("version", 0))
        if remote_ver <= room._version:
            return False

        connections = room.connections
        joined = room.joined
        timer_gen = room._timer_generation
        warning_sent = room._warning_sent
        finalized = room._finalized

        refreshed = self._room_from_data(data)
        refreshed._version = remote_ver
        refreshed.connections = connections
        refreshed.joined = joined
        refreshed._timer_generation = timer_gen
        refreshed._warning_sent = warning_sent
        refreshed._finalized = data.get("finalized", finalized)
        refreshed.elo_changes = room.elo_changes

        async with self._lock:
            self._rooms[room.match_id] = refreshed
        return True

    def _room_from_data(self, data: dict[str, Any]) -> GameRoom:
        game = hydrate_game_from_data(data)
        room = GameRoom(
            match_id=data["match_id"],
            mode=data.get("mode", "quick"),
            game=game,
            p1_id=data["p1_id"],
            p2_id=data["p2_id"],
            p1_username=data["p1_username"],
            p2_username=data["p2_username"],
            p1_deck_id=data["p1_deck_id"],
            p2_deck_id=data["p2_deck_id"],
            p1_faction=data.get("p1_faction"),
            p2_faction=data.get("p2_faction"),
            match_started_at=data.get("match_started_at", time.time()),
            turn_deadline=data.get("turn_deadline"),
            bot_difficulty=data.get("bot_difficulty"),
        )
        room._version = int(data.get("version", 0))
        return room

    def _timer_remaining(self, room: GameRoom) -> int:
        if room.turn_deadline is None:
            return TURN_TIMER_SECONDS
        return max(0, int(room.turn_deadline - time.time()))

    def _match_elapsed(self, room: GameRoom) -> int:
        return max(0, int(time.time() - room.match_started_at))

    def _arm_turn_timer(self, room: GameRoom) -> None:
        room.turn_deadline = time.time() + TURN_TIMER_SECONDS
        room._timer_generation += 1
        room._warning_sent = False

    async def _schedule_turn_timer(self, room: GameRoom) -> None:
        if not room.connections and not await is_room_owner(room.match_id):
            return
        generation = room._timer_generation
        asyncio.create_task(self._run_turn_timer(room, generation))

    async def _run_turn_timer(self, room: GameRoom, generation: int) -> None:
        if room.turn_deadline is None:
            return

        warning_at = room.turn_deadline - TIMER_WARNING_SECONDS
        now = time.time()
        if warning_at > now:
            await asyncio.sleep(warning_at - now)
        if room._timer_generation != generation or room.game.game_over:
            return
        if not room._warning_sent:
            room._warning_sent = True
            await self._broadcast(room, "timer_warning", {
                "seconds_left": TIMER_WARNING_SECONDS,
                "player": player_key(room.game.current_player),
            })

        now = time.time()
        if room.turn_deadline and room.turn_deadline > now:
            await asyncio.sleep(room.turn_deadline - now)
        if room._timer_generation != generation or room.game.game_over:
            return

        acquired = await cache_set_nx(
            timer_lock_key(room.match_id),
            get_worker_id(),
            ttl=10,
        )
        if not acquired:
            return

        await self._handle_turn_timeout(room)

    async def _handle_turn_timeout(self, room: GameRoom) -> None:
        async with room.lock:
            if room.game.game_over:
                return
            timed_out = room.game.current_player
            room.game.end_turn()
            await self._broadcast_states(room)
            await self._broadcast(room, "turn_timeout", {
                "player": player_key(timed_out),
                "reason": "timer_expired",
            })
            await self._persist_room(room)

        if await self._after_action(room):
            return

        await self._begin_turn(room)

    async def _begin_turn(self, room: GameRoom) -> None:
        self._arm_turn_timer(room)
        await self._broadcast(room, "turn_start", {
            "player": player_key(room.game.current_player),
            "timer": TURN_TIMER_SECONDS,
            "timer_remaining": self._timer_remaining(room),
            "turn_deadline_ts": room.turn_deadline,
        })
        await self._schedule_turn_timer(room)
        await self._maybe_run_bot(room)

    async def get_room(self, match_id: str, *, prefer_redis: bool = False) -> GameRoom | None:
        if prefer_redis:
            data = await load_room_data(match_id)
            if data:
                async with self._lock:
                    existing = self._rooms.get(match_id)
                if existing:
                    await self._sync_room_from_redis(existing)
                    async with self._lock:
                        return self._rooms.get(match_id)
                room = self._room_from_data(data)
                room._finalized = data.get("finalized", False)
                async with self._lock:
                    self._rooms[match_id] = room
                return room

        async with self._lock:
            room = self._rooms.get(match_id)
            if room:
                return room

        data = await load_room_data(match_id)
        if not data:
            return None

        room = self._room_from_data(data)
        room._finalized = data.get("finalized", False)
        async with self._lock:
            self._rooms[match_id] = room
        if (
            room.connections
            and not room.game.game_over
            and room.turn_deadline
            and room.turn_deadline > time.time()
        ):
            await self._schedule_turn_timer(room)
        return room

    async def get_replay(self, match_id: str, db: AsyncSession | None = None) -> dict | None:
        if db:
            try:
                match_row = await db.get(Match, uuid.UUID(match_id))
                if match_row and match_row.replay_data:
                    return match_row.replay_data
            except ValueError:
                pass
        return None

    async def _persist_room(self, room: GameRoom) -> None:
        await save_room(room)
        await publish_match_event(
            room.match_id,
            STATE_REFRESH_EVENT,
            {"version": room._version},
        )

    async def connect(self, match_id: str, user_id: str, ws: WebSocket) -> GameRoom:
        room = await self.get_room(match_id)
        if not room:
            raise ValueError("match_not_found")
        if is_bot_user(user_id):
            raise ValueError("bot_cannot_connect")
        if user_id not in (room.p1_id, room.p2_id):
            raise ValueError("not_participant")
        room.connections[user_id] = ws
        await register_presence(match_id, user_id)
        await claim_room_owner(match_id)
        return room

    async def disconnect(self, match_id: str, user_id: str, ws=None) -> None:
        room = await self.get_room(match_id)
        if room:
            if ws is None or room.connections.get(user_id) is ws:
                room.connections.pop(user_id, None)
            await unregister_presence(match_id, user_id)

    async def handle_join(self, room: GameRoom, user_id: str) -> None:
        if is_bot_user(user_id):
            return
        room.joined.add(user_id)
        slot = room.player_slot(user_id)
        if slot is None:
            return
        await self._send(room, user_id, "game_state", self._state_payload(room, slot))

        if room.mode == "pve":
            room.joined.add(room.p2_id)
            ready = True
        else:
            ready = len(room.joined) >= 2

        if ready and room.turn_deadline is None:
            room.match_started_at = time.time()
            await self._begin_turn(room)

    async def handle_play_card(
        self,
        room: GameRoom,
        user_id: str,
        card_id: str,
        position: str,
        slot: int | None = None,
        target_id: str | None = None,
    ) -> dict[str, Any] | None:
        async with room.lock:
            if room.game.pending_resolution:
                raise GameError("Resolve pending effect choice first")
            player = room.player_slot(user_id)
            if player is None or room.game.current_player != player:
                raise GameError("Not your turn")
            line = "front" if position == "front" else "support"
            side = room.game.battlefield.side_for(player)
            card = next((c for c in side.hand if c.uid == card_id), None) or next((c for c in side.hand if c.card_id == card_id), None)
            if not card:
                raise GameError(f"Card {card_id} not in hand")

            if is_unit_card(card.card_type):
                target_line = side.front_line if line == "front" else side.support_line
                max_len = 5 if line == "front" else 4
                if len(target_line) >= max_len:
                    raise GameError(f"{line} line is full")
                insert_slot = slot if slot is not None else len(target_line)
                played = room.game.deploy(card.uid, line, slot=insert_slot)
                await self._broadcast(room, "card_played", {
                    "player": player_key(player),
                    "card_id": played.card_id,
                    "instance_id": played.uid,
                    "position": position,
                    "slot": insert_slot,
                    "card_type": "unit",
                })
            else:
                played = room.game.play_spell(card.uid, target_uid=target_id)
                await self._broadcast(room, "card_played", {
                    "player": player_key(player),
                    "card_id": played.card_id,
                    "instance_id": played.uid,
                    "position": None,
                    "slot": None,
                    "card_type": played.card_type,
                    "pending_choice": room.game.pending_choice_public() is not None,
                })

            if room.game.pending_resolution:
                await self._broadcast(room, "effect_choice", room.game.pending_choice_public())

            await self._broadcast_states(room)
            await self._persist_room(room)
            await self._check_game_over(room)

        return await self._after_action(room)

    async def handle_resolve_choice(
        self,
        room: GameRoom,
        user_id: str,
        choice_id: str,
        target_id: str | None = None,
    ) -> dict[str, Any] | None:
        async with room.lock:
            player = room.player_slot(user_id)
            if player is None or room.game.current_player != player:
                raise GameError("Not your turn")
            if not room.game.pending_resolution:
                raise GameError("No pending effect choice")

            room.game.resolve_effect_choice(choice_id, target_uid=target_id)
            await self._broadcast(room, "choice_resolved", {
                "player": player_key(player),
                "choice_id": choice_id,
                "target_id": target_id,
            })
            await self._broadcast_states(room)
            await self._persist_room(room)
            await self._check_game_over(room)

        return await self._after_action(room)

    async def handle_resolve_discard(
        self,
        room: GameRoom,
        user_id: str,
        card_uids: list[str],
    ) -> dict[str, Any] | None:
        async with room.lock:
            player = room.player_slot(user_id)
            if player is None or room.game.current_player != player:
                raise GameError("Not your turn")
            room.game.resolve_discard(card_uids)
            await self._broadcast(room, "discard_resolved", {
                "player": player_key(player),
                "card_uids": card_uids,
            })
            await self._broadcast_states(room)
            await self._persist_room(room)
            await self._check_game_over(room)
        return await self._after_action(room)

    async def handle_move_unit(
        self,
        room: GameRoom,
        user_id: str,
        unit_id: str,
        to_line: str,
    ) -> dict[str, Any] | None:
        async with room.lock:
            player = room.player_slot(user_id)
            if player is None or room.game.current_player != player:
                raise GameError("Not your turn")
            moved = room.game.move_unit(unit_id, to_line)
            await self._broadcast(room, "unit_moved", {
                "player": player_key(player),
                "unit_id": moved.uid,
                "to_line": to_line,
            })
            await self._broadcast_states(room)
            await self._persist_room(room)
        return await self._after_action(room)

    async def handle_use_ability(
        self,
        room: GameRoom,
        user_id: str,
        card_id: str,
        target_id: str | None = None,
    ) -> dict[str, Any] | None:
        async with room.lock:
            player = room.player_slot(user_id)
            if player is None or room.game.current_player != player:
                raise GameError("Not your turn")

            side = room.game.battlefield.side_for(player)
            unit = room.game._find_in_list(side.all_units, card_id)
            if not unit:
                for u in side.all_units:
                    if u.card_id == card_id:
                        unit = u
                        break
            if not unit:
                raise GameError(f"Unit {card_id} not on battlefield")

            room.game.use_ability(unit.uid, target_uid=target_id)
            await self._broadcast(room, "ability_used", {
                "player": player_key(player),
                "card_id": unit.card_id,
                "instance_id": unit.uid,
                "target_id": target_id,
            })
            await self._broadcast_states(room)
            await self._persist_room(room)
            await self._check_game_over(room)

        return await self._after_action(room)

    async def handle_attack(
        self,
        room: GameRoom,
        user_id: str,
        attacker_ids: list[str],
        target_id: str | None,
    ) -> dict[str, Any] | None:
        async with room.lock:
            player = room.player_slot(user_id)
            if player is None or room.game.current_player != player:
                raise GameError("Not your turn")
            if room.game.phase != Phase.COMBAT:
                room.game.begin_combat_phase()
                await self._broadcast(room, "combat_phase", {
                    "player": player_key(player),
                })

            for attacker_id in attacker_ids:
                before_opp = room.game.battlefield.opponent_side(player).all_units[:]
                before_opp_hp = room.game.battlefield.opponent_side(player).spirit_total
                room.game.attack(attacker_id, target_id)
                after_opp = room.game.battlefield.opponent_side(player).all_units
                after_opp_hp = room.game.battlefield.opponent_side(player).spirit_total
                damage = max(0, before_opp_hp - after_opp_hp)
                destroyed = [
                    u.uid for u in before_opp if u not in after_opp and not u.alive
                ]

                await self._broadcast(room, "attack_result", {
                    "attacker_id": attacker_id,
                    "target_id": target_id,
                    "damage": damage,
                    "destroyed": destroyed,
                })

            await self._broadcast_states(room)
            await self._persist_room(room)
            await self._check_game_over(room)

        return await self._after_action(room)

    async def handle_end_turn(self, room: GameRoom, user_id: str) -> dict[str, Any] | None:
        async with room.lock:
            player = room.player_slot(user_id)
            if player is None or room.game.current_player != player:
                raise GameError("Not your turn")
            room.game.end_turn()
            await self._broadcast_states(room)
            await self._persist_room(room)
            await self._check_game_over(room)

        if not room.game.game_over:
            await self._begin_turn(room)
            return None
        return await self._after_action(room)

    async def handle_surrender(self, room: GameRoom, user_id: str, db: AsyncSession) -> dict[str, Any]:
        async with room.lock:
            player = room.player_slot(user_id)
            if player is None:
                raise GameError("Not a participant")
            winner = 2 if player == 1 else 1
            room.game.game_over = True
            room.game.winner = winner
            return await self._finalize(room, db, reason="surrender", loser_id=user_id)

    async def finalize_if_over(self, room: GameRoom, db: AsyncSession) -> dict[str, Any] | None:
        async with room.lock:
            if room._finalized or not room.game.game_over or not room.game.winner:
                return None

            try:
                match_row = await db.get(Match, uuid.UUID(room.match_id))
            except ValueError:
                match_row = None
            if match_row and match_row.ended_at:
                room._finalized = True
                return None

            loser_id = room.p2_id if room.game.winner == 1 else room.p1_id
            return await self._finalize(room, db, reason="combat", loser_id=loser_id)

    async def _check_game_over(self, room: GameRoom) -> None:
        """Ensure clients see terminal state when HP reaches zero mid-action."""
        if room.game.game_over:
            await self._broadcast_states(room)

    async def _after_action(self, room: GameRoom) -> dict[str, Any] | None:
        """Finalize match when the engine reports game over."""
        if not room.game.game_over or not room.game.winner:
            return None
        async with async_session() as db:
            return await self.finalize_if_over(room, db)

    async def _finalize(
        self,
        room: GameRoom,
        db: AsyncSession,
        *,
        reason: str,
        loser_id: str,
    ) -> dict[str, Any]:
        if room._finalized:
            return {}

        room._finalized = True
        winner_id = room.p1_id if room.game.winner == 1 else room.p2_id
        winner = await db.get(User, uuid.UUID(winner_id))
        loser = await db.get(User, uuid.UUID(loser_id))

        if room.mode == "ranked" and winner and loser:
            w_delta, l_delta = calculate_elo_changes(winner.elo, loser.elo)
            winner.elo += w_delta
            loser.elo = max(0, loser.elo + l_delta)
            if winner_id == room.p1_id:
                room.elo_changes = {"p1": w_delta, "p2": l_delta}
            else:
                room.elo_changes = {"p1": l_delta, "p2": w_delta}
            await invalidate_leaderboard_cache()
        else:
            room.elo_changes = {"p1": 0, "p2": 0}

        battle_report = build_battle_report(
            room.game,
            match_id=room.match_id,
            mode=room.mode,
            p1_id=room.p1_id,
            p2_id=room.p2_id,
            p1_username=room.p1_username,
            p2_username=room.p2_username,
            p1_deck_id=room.p1_deck_id,
            p2_deck_id=room.p2_deck_id,
            p1_faction=room.p1_faction,
            p2_faction=room.p2_faction,
            end_reason=reason,
            elo_changes=room.elo_changes,
        )

        rewards = {"ink": 0, "packs": []}
        if winner:
            winner_faction = room.p1_faction if winner_id == room.p1_id else room.p2_faction
            rewards = await apply_battle_rewards(
                winner, db, faction_code=winner_faction
            )
            battle_report["rewards"] = rewards

        match_row = await db.get(Match, uuid.UUID(room.match_id))
        if match_row:
            match_row.winner_id = uuid.UUID(winner_id)
            match_row.ended_at = datetime.now(UTC)
            match_row.turns_played = room.game.turn
            match_row.mode = room.mode
            match_row.end_reason = reason
            match_row.replay_data = battle_report

        room._timer_generation += 1
        room.turn_deadline = None

        await db.commit()

        async with self._lock:
            self._rooms.pop(room.match_id, None)

        await delete_room(room.match_id)
        await matchmaking.clear_active_match(room.p1_id)
        await matchmaking.clear_active_match(room.p2_id)

        event_log = battle_report.get("event_log") or []
        payload = {
            "winner_id": winner_id,
            "elo_change": room.elo_changes,
            "reason": reason,
            "mode": room.mode,
            "battle_report_id": room.match_id,
            "rewards": rewards,
            "battle_summary": battle_report.get("summary"),
            "turns_played": battle_report.get("turns_played"),
            "players": battle_report.get("players"),
            "event_log": event_log[-20:],
        }
        await self._broadcast(room, "game_over", payload)
        return payload

    async def _maybe_run_bot(self, room: GameRoom) -> None:
        if room.game.game_over:
            return
        bot_id = room.p2_id if is_bot_user(room.p2_id) else (
            room.p1_id if is_bot_user(room.p1_id) else None
        )
        if not bot_id:
            return
        slot = room.player_slot(bot_id)
        if slot is None or room.game.current_player != slot:
            return
        asyncio.create_task(self._run_bot_turn(room, bot_id))

    async def _run_bot_turn(self, room: GameRoom, bot_id: str) -> None:
        await asyncio.sleep(0.6)
        bot_slot = room.player_slot(bot_id)
        if bot_slot is None:
            return

        for _ in range(40):
            async with room.lock:
                if room.game.game_over or room.game.current_player != bot_slot:
                    return
                difficulty = room.bot_difficulty or "medium"
                actions = decide_bot_actions(room.game, bot_slot, difficulty=difficulty)
                if not actions:
                    return
                action = actions[0]

            try:
                finalize = await self._execute_bot_action(room, bot_id, action)
                if finalize:
                    return
            except GameError:
                need_end_turn = False
                async with room.lock:
                    if room.game.phase.value == "COMBAT":
                        need_end_turn = True
                    elif room.game.phase.value == "MAIN":
                        try:
                            room.game.begin_combat_phase()
                            await self._broadcast_states(room)
                            await self._persist_room(room)
                        except GameError:
                            need_end_turn = True
                if need_end_turn:
                    try:
                        await self.handle_end_turn(room, bot_id)
                    except GameError:
                        pass
                return
            await asyncio.sleep(0.25)

    async def _execute_bot_action(
        self,
        room: GameRoom,
        bot_id: str,
        action: BotAction,
    ) -> dict[str, Any] | None:
        if action.kind == "play_card" and action.card_uid:
            side = room.game.battlefield.side_for(room.player_slot(bot_id) or 2)
            card = room.game._find_in_list(side.hand, action.card_uid)
            card_id = card.card_id if card else action.card_uid
            return await self.handle_play_card(
                room,
                bot_id,
                card_id,
                action.position,
                action.slot,
                action.target_id,
            )
        if action.kind == "begin_combat":
            async with room.lock:
                if room.game.phase != Phase.COMBAT:
                    room.game.begin_combat_phase()
                    await self._broadcast(room, "combat_phase", {
                        "player": player_key(room.game.current_player),
                    })
                    await self._broadcast_states(room)
                    await self._persist_room(room)
            return None
        if action.kind == "attack" and action.attacker_ids:
            return await self.handle_attack(
                room,
                bot_id,
                action.attacker_ids,
                action.target_id,
            )
        if action.kind == "resolve_choice" and action.choice_id:
            return await self.handle_resolve_choice(
                room,
                bot_id,
                action.choice_id,
                action.target_id,
            )
        if action.kind == "resolve_discard" and action.card_uids:
            return await self.handle_resolve_discard(room, bot_id, action.card_uids)
        if action.kind == "end_turn":
            return await self.handle_end_turn(room, bot_id)
        return None

    def _state_payload(self, room: GameRoom, viewer_slot: int) -> dict:
        return build_game_state(
            room.game,
            viewer_slot,
            timer_remaining=self._timer_remaining(room),
            match_elapsed=self._match_elapsed(room),
            turn_deadline_ts=room.turn_deadline,
        )

    async def _broadcast_states(self, room: GameRoom) -> None:
        await self._broadcast_states_local(room)
        await publish_match_event(room.match_id, STATE_REFRESH_EVENT, {})

    async def _broadcast_states_local(self, room: GameRoom) -> None:
        for uid, ws in list(room.connections.items()):
            slot = room.player_slot(uid)
            if slot:
                await self._send_ws(ws, "game_state", self._state_payload(room, slot))

    async def _broadcast(self, room: GameRoom, event: str, payload: dict) -> None:
        await self._broadcast_local(room, event, payload)
        await publish_match_event(room.match_id, event, payload)

    async def _broadcast_local(self, room: GameRoom, event: str, payload: dict) -> None:
        for uid, ws in list(room.connections.items()):
            try:
                await self._send_ws(ws, event, payload)
            except Exception:
                room.connections.pop(uid, None)

    async def _send(self, room: GameRoom, user_id: str, event: str, payload: dict) -> None:
        ws = room.connections.get(user_id)
        if ws:
            await self._send_ws(ws, event, payload)

    @staticmethod
    async def _send_ws(ws: WebSocket, event: str, payload: dict) -> None:
        await ws.send_json({"event": event, "payload": payload})


game_manager = GameManager()


async def expand_deck_cards(db: AsyncSession, deck: Deck) -> list[dict]:
    from app.core.card_level_stats import apply_level_to_card_dict
    from app.models import UserCard

    stmt = select(DeckCard).where(DeckCard.deck_id == deck.id)
    result = await db.execute(stmt)
    entries = result.scalars().all()
    card_ids = [e.card_id for e in entries]
    cards_result = await db.execute(select(Card).where(Card.id.in_(card_ids)))
    cards_map = {c.id: c for c in cards_result.scalars().all()}

    uc_result = await db.execute(
        select(UserCard).where(
            UserCard.user_id == deck.user_id,
            UserCard.card_id.in_(card_ids),
        )
    )
    levels_map = {uc.card_id: uc.level or 1 for uc in uc_result.scalars().all()}

    expanded: list[dict] = []
    for entry in entries:
        card = cards_map.get(entry.card_id)
        if not card:
            logger.warning("Deck %s contains missing card %s, skipping", deck.id, entry.card_id)
            continue
        level = levels_map.get(entry.card_id, 1)
        for _ in range(entry.quantity):
            row = {
                "id": card.id,
                "name": card.name,
                "cost": card.cost,
                "power": card.power or 0,
                "grit": card.grit or 0,
                "spirit": card.spirit or 1,
                "faction_code": card.faction_code,
                "card_type": card.card_type or "character",
                "effect_text": card.effect_text or "",
                "effect_code": card.effect_code or "",
                "subtype": getattr(card, "unit_type", None) or "",
            }
            expanded.append(
                apply_level_to_card_dict(row, level=level, unit_type=row.get("subtype"))
            )
    return expanded
