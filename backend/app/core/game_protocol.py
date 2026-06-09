"""WebSocket / REST game state serialization (DEVELOPMENT.md §4.11)."""
from __future__ import annotations

from typing import TYPE_CHECKING

from .game_engine import CardInstance, Phase

if TYPE_CHECKING:
    from .game_engine import GameState

PHASE_API: dict[Phase, str] = {
    Phase.DRAW: "draw",
    Phase.MAIN: "main",
    Phase.COMBAT: "combat",
    Phase.END: "end",
}

TURN_TIMER_SECONDS = 100
TIMER_WARNING_SECONDS = 20
STARTING_HP = 30


def player_key(player: int) -> str:
    return "p1" if player == 1 else "p2"


def _unit_public(unit: CardInstance) -> dict:
    return {
        "uid": unit.uid,
        "card_id": unit.card_id,
        "name": unit.name,
        "cost": unit.cost,
        "power": unit.power,
        "spirit": unit.spirit,
        "grit": unit.grit,
        "can_attack": unit.can_attack and not unit.has_attacked and unit.cannot_attack_turns <= 0,
        "faction": unit.faction,
        "card_type": unit.card_type,
        "unit_type": unit.unit_type,
        "keywords": sorted(unit.keywords),
        "synergy_tags": unit.synergy_tags,
        "base_power": unit.base_power,
        "base_spirit": unit.base_spirit,
        "immune_turns": unit.immune_turns,
        "silenced_turns": unit.silenced_turns,
        "controlled": unit.controlled_by is not None,
    }


def _trap_public(card: CardInstance) -> dict:
    return {
        "uid": card.uid,
        "card_id": card.card_id,
        "name": card.name,
        "cost": card.cost,
    }


def _player_view(game: GameState, player_num: int, *, reveal_hand: bool) -> dict:
    side = game.battlefield.side_for(player_num)
    max_hp = game.starting_hp.get(player_num, STARTING_HP)
    view: dict = {
        "hp": side.spirit_total,
        "max_hp": max_hp,
        "ink": side.ink,
        "max_ink": side.max_ink,
        "front_line": [_unit_public(u) for u in side.front_line],
        "support_line": [_unit_public(u) for u in side.support_line],
        "deck_count": len(side.deck),
        "pen_count": len(side.graveyard),
        "traps": [_trap_public(t) for t in side.traps],
        "advisor_units": [_unit_public(u) for u in side.advisor_units],
    }
    if reveal_hand:
        view["hand"] = [_unit_public(u) for u in side.hand]
    else:
        view["hand_count"] = len(side.hand)
    return view


def build_game_state(
    game: GameState,
    viewer_player: int,
    *,
    timer_remaining: int | None = None,
    match_elapsed: int | None = None,
    turn_deadline_ts: float | None = None,
) -> dict:
    """Full game_state payload for WebSocket (fog of war on opponent hand)."""
    opponent = 2 if viewer_player == 1 else 1
    remaining = timer_remaining if timer_remaining is not None else TURN_TIMER_SECONDS
    return {
        "turn": game.turn,
        "phase": PHASE_API.get(game.phase, "main"),
        "current_player": player_key(game.current_player),
        "timer": TURN_TIMER_SECONDS,
        "timer_remaining": remaining,
        "turn_deadline_ts": turn_deadline_ts,
        "match_elapsed": match_elapsed or 0,
        "game_over": game.game_over,
        "winner": player_key(game.winner) if game.winner else None,
        "players": {
            "p1": _player_view(game, 1, reveal_hand=viewer_player == 1),
            "p2": _player_view(game, 2, reveal_hand=viewer_player == 2),
        },
        # convenience: which seat the viewer occupies
        "viewer": player_key(viewer_player),
        "opponent": player_key(opponent),
        "corridor_controller": (
            player_key(game.corridor_controller) if game.corridor_controller else None
        ),
        "pending_choice": game.pending_choice_public(),
    }


def build_event_log(game: GameState) -> list[dict]:
    return [
        {
            "turn": _turn_for_log_index(game, idx),
            "phase": entry.phase.value,
            "player": player_key(entry.player),
            "action": entry.action,
            "detail": entry.detail,
        }
        for idx, entry in enumerate(game.logs)
    ]


def _turn_for_log_index(game: GameState, idx: int) -> int:
    """Approximate turn number for a log entry (monotonic with index)."""
    if idx < len(game.logs):
        # Walk backwards: game_start is turn 1
        turn = 1
        for i in range(idx + 1):
            if game.logs[i].action == "end_turn":
                turn += 1
        return min(turn, game.turn)
    return game.turn


def build_replay_data(game: GameState) -> dict:
    return {
        "game_id": game.id,
        "turns_played": game.turn,
        "winner": player_key(game.winner) if game.winner else None,
        "logs": build_event_log(game),
        "final_snapshot": game.snapshot(),
    }


def build_battle_report(
    game: GameState,
    *,
    match_id: str,
    mode: str,
    p1_id: str,
    p2_id: str,
    p1_username: str,
    p2_username: str,
    p1_deck_id: str,
    p2_deck_id: str,
    p1_faction: str | None,
    p2_faction: str | None,
    end_reason: str,
    elo_changes: dict[str, int],
) -> dict:
    """Full battle report persisted to PostgreSQL on match end."""
    winner_key = player_key(game.winner) if game.winner else None
    action_counts: dict[str, int] = {}
    for entry in game.logs:
        action_counts[entry.action] = action_counts.get(entry.action, 0) + 1

    return {
        "match_id": match_id,
        "mode": mode,
        "game_id": game.id,
        "turns_played": game.turn,
        "winner": winner_key,
        "winner_id": p1_id if winner_key == "p1" else (p2_id if winner_key == "p2" else None),
        "end_reason": end_reason,
        "elo_changes": elo_changes,
        "players": {
            "p1": {
                "id": p1_id,
                "username": p1_username,
                "deck_id": p1_deck_id,
                "faction": p1_faction,
                "final_hp": game.battlefield.player1.spirit_total,
            },
            "p2": {
                "id": p2_id,
                "username": p2_username,
                "deck_id": p2_deck_id,
                "faction": p2_faction,
                "final_hp": game.battlefield.player2.spirit_total,
            },
        },
        "summary": {
            "total_events": len(game.logs),
            "action_counts": action_counts,
        },
        "event_log": build_event_log(game),
        "final_snapshot": game.snapshot(),
    }
