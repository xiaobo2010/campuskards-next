"""Active game rooms — in-memory WebSocket fan-out + Redis state persistence."""
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.game_engine import GameError, GameState, Phase, create_game
from app.core.database import async_session
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
    delete_room,
    hydrate_game_from_data,
    load_room_data,
    save_room,
)
from app.services.matchmaking import MatchMode, MatchTicket, matchmaking


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
    connections: dict[str, WebSocket] = field(default_factory=dict)
    joined: set[str] = field(default_factory=set)
    elo_changes: dict[str, int] = field(default_factory=dict)
    match_started_at: float = field(default_factory=time.time)
    turn_deadline: float | None = None
    _timer_generation: int = 0
    _warning_sent: bool = False
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

    async def create_room(
        self,
        ticket: MatchTicket,
        p1_cards: list[dict],
        p2_cards: list[dict],
    ) -> GameRoom:
        game = create_game(p1_cards, p2_cards)
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
        )
        async with self._lock:
            self._rooms[ticket.match_id] = room
        await save_room(room)
        await matchmaking.register_active_match(ticket)
        return room

    def _room_from_data(self, data: dict[str, Any]) -> GameRoom:
        game = hydrate_game_from_data(data)
        return GameRoom(
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
        )

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

        if room.game.game_over:
            async with async_session() as db:
                await self.finalize_if_over(room, db)
            return

        await self._begin_turn(room)
        async with async_session() as db:
            await self.finalize_if_over(room, db)

    async def _begin_turn(self, room: GameRoom) -> None:
        self._arm_turn_timer(room)
        await self._broadcast(room, "turn_start", {
            "player": player_key(room.game.current_player),
            "timer": TURN_TIMER_SECONDS,
            "timer_remaining": self._timer_remaining(room),
            "turn_deadline_ts": room.turn_deadline,
        })
        await self._schedule_turn_timer(room)

    async def get_room(self, match_id: str) -> GameRoom | None:
        async with self._lock:
            room = self._rooms.get(match_id)
            if room:
                return room

        data = await load_room_data(match_id)
        if not data:
            return None

        room = self._room_from_data(data)
        async with self._lock:
            self._rooms[match_id] = room
        if not room.game.game_over and room.turn_deadline and room.turn_deadline > time.time():
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

    async def connect(self, match_id: str, user_id: str, ws: WebSocket) -> GameRoom:
        room = await self.get_room(match_id)
        if not room:
            raise ValueError("match_not_found")
        if user_id not in (room.p1_id, room.p2_id):
            raise ValueError("not_participant")
        room.connections[user_id] = ws
        return room

    async def disconnect(self, match_id: str, user_id: str) -> None:
        room = await self.get_room(match_id)
        if room:
            room.connections.pop(user_id, None)

    async def handle_join(self, room: GameRoom, user_id: str) -> None:
        room.joined.add(user_id)
        slot = room.player_slot(user_id)
        if slot is None:
            return
        await self._send(room, user_id, "game_state", self._state_payload(room, slot))
        if len(room.joined) >= 2 and room.turn_deadline is None:
            room.match_started_at = time.time()
            await self._begin_turn(room)

    async def handle_play_card(
        self,
        room: GameRoom,
        user_id: str,
        card_id: str,
        position: str,
        slot: int | None = None,
    ) -> None:
        async with room.lock:
            player = room.player_slot(user_id)
            if player is None or room.game.current_player != player:
                raise GameError("Not your turn")
            line = "front" if position == "front" else "support"
            side = room.game.battlefield.side_for(player)
            card = room.game._find_in_list(side.hand, card_id)
            if not card:
                for c in side.hand:
                    if c.card_id == card_id:
                        card = c
                        break
            if not card:
                raise GameError(f"Card {card_id} not in hand")

            target_line = side.front_line if line == "front" else side.support_line
            if slot is not None and 0 <= slot < len(target_line):
                if len(target_line) >= (5 if line == "front" else 4):
                    raise GameError(f"{line} line is full")

            deployed = room.game.deploy(card.uid, line)
            await self._broadcast(room, "card_played", {
                "player": player_key(player),
                "card_id": deployed.card_id,
                "instance_id": deployed.uid,
                "position": position,
                "slot": slot if slot is not None else len(target_line) - 1,
            })
            await self._broadcast_states(room)
            await self._persist_room(room)
            await self._check_game_over(room)

    async def handle_attack(
        self,
        room: GameRoom,
        user_id: str,
        attacker_ids: list[str],
        target_id: str | None,
    ) -> None:
        async with room.lock:
            player = room.player_slot(user_id)
            if player is None or room.game.current_player != player:
                raise GameError("Not your turn")
            if room.game.phase != Phase.COMBAT:
                room.game.begin_combat_phase()

            destroyed: list[str] = []
            for attacker_id in attacker_ids:
                before_opp = room.game.battlefield.opponent_side(player).all_units[:]
                room.game.attack(attacker_id, target_id)
                after_opp = room.game.battlefield.opponent_side(player).all_units
                for u in before_opp:
                    if u not in after_opp and not u.alive:
                        destroyed.append(u.uid)

                await self._broadcast(room, "attack_result", {
                    "attacker_id": attacker_id,
                    "target_id": target_id,
                    "damage": 0,
                    "destroyed": destroyed,
                })

            await self._broadcast_states(room)
            await self._persist_room(room)
            await self._check_game_over(room)

    async def handle_end_turn(self, room: GameRoom, user_id: str) -> None:
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
        if not room.game.game_over or not room.game.winner:
            return None
        loser_id = room.p2_id if room.game.winner == 1 else room.p1_id
        return await self._finalize(room, db, reason="combat", loser_id=loser_id)

    async def _check_game_over(self, room: GameRoom) -> None:
        pass

    async def _finalize(
        self,
        room: GameRoom,
        db: AsyncSession,
        *,
        reason: str,
        loser_id: str,
    ) -> dict[str, Any]:
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

        async with self._lock:
            self._rooms.pop(room.match_id, None)

        await delete_room(room.match_id)
        await matchmaking.clear_active_match(room.p1_id)
        await matchmaking.clear_active_match(room.p2_id)
        await db.commit()

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

    def _state_payload(self, room: GameRoom, viewer_slot: int) -> dict:
        return build_game_state(
            room.game,
            viewer_slot,
            timer_remaining=self._timer_remaining(room),
            match_elapsed=self._match_elapsed(room),
            turn_deadline_ts=room.turn_deadline,
        )

    async def _broadcast_states(self, room: GameRoom) -> None:
        for uid, ws in list(room.connections.items()):
            slot = room.player_slot(uid)
            if slot:
                await self._send_ws(ws, "game_state", self._state_payload(room, slot))

    async def _broadcast(self, room: GameRoom, event: str, payload: dict) -> None:
        for ws in list(room.connections.values()):
            await self._send_ws(ws, event, payload)

    async def _send(self, room: GameRoom, user_id: str, event: str, payload: dict) -> None:
        ws = room.connections.get(user_id)
        if ws:
            await self._send_ws(ws, event, payload)

    @staticmethod
    async def _send_ws(ws: WebSocket, event: str, payload: dict) -> None:
        await ws.send_json({"event": event, "payload": payload})


game_manager = GameManager()


async def expand_deck_cards(db: AsyncSession, deck: Deck) -> list[dict]:
    stmt = select(DeckCard).where(DeckCard.deck_id == deck.id)
    result = await db.execute(stmt)
    entries = result.scalars().all()
    card_ids = [e.card_id for e in entries]
    cards_result = await db.execute(select(Card).where(Card.id.in_(card_ids)))
    cards_map = {c.id: c for c in cards_result.scalars().all()}

    expanded: list[dict] = []
    for entry in entries:
        card = cards_map.get(entry.card_id)
        if not card:
            continue
        for _ in range(entry.quantity):
            expanded.append({
                "id": card.id,
                "name": card.name,
                "cost": card.cost,
                "power": card.power or 0,
                "grit": card.grit or 0,
                "spirit": card.spirit or 1,
                "faction_code": card.faction_code,
                "card_type": card.card_type,
            })
    return expanded
