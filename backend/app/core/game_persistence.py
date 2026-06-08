"""Serialize / deserialize GameState and active room metadata for Redis."""
from __future__ import annotations

from typing import Any

from .battlefield import Battlefield, PlayerField
from .game_engine import CardInstance, GameLogEntry, GameState, Phase


def _card_to_dict(card: CardInstance) -> dict[str, Any]:
    return {
        "card_id": card.card_id,
        "name": card.name,
        "cost": card.cost,
        "power": card.power,
        "grit": card.grit,
        "spirit": card.spirit,
        "faction": card.faction,
        "card_type": card.card_type,
        "uid": card.uid,
        "can_attack": card.can_attack,
        "has_attacked": card.has_attacked,
        "owner": card.owner,
    }


def _card_from_dict(data: dict[str, Any]) -> CardInstance:
    return CardInstance(
        card_id=data["card_id"],
        name=data["name"],
        cost=data.get("cost", 0),
        power=data.get("power", 0),
        grit=data.get("grit", 0),
        spirit=data.get("spirit", 1),
        faction=data.get("faction", ""),
        card_type=data.get("card_type", "character"),
        uid=data["uid"],
        can_attack=data.get("can_attack", False),
        has_attacked=data.get("has_attacked", False),
        owner=data.get("owner", 1),
    )


def _cards_from_list(items: list[dict[str, Any]]) -> list[CardInstance]:
    return [_card_from_dict(item) for item in items]


def _side_to_dict(side: PlayerField) -> dict[str, Any]:
    return {
        "ink": side.ink,
        "max_ink": side.max_ink,
        "spirit_total": side.spirit_total,
        "front_line": [_card_to_dict(u) for u in side.front_line],
        "support_line": [_card_to_dict(u) for u in side.support_line],
        "hand": [_card_to_dict(u) for u in side.hand],
        "deck": [_card_to_dict(u) for u in side.deck],
        "graveyard": [_card_to_dict(u) for u in side.graveyard],
    }


def _side_from_dict(data: dict[str, Any]) -> PlayerField:
    return PlayerField(
        front_line=_cards_from_list(data.get("front_line", [])),
        support_line=_cards_from_list(data.get("support_line", [])),
        hand=_cards_from_list(data.get("hand", [])),
        deck=_cards_from_list(data.get("deck", [])),
        graveyard=_cards_from_list(data.get("graveyard", [])),
        ink=data.get("ink", 0),
        max_ink=data.get("max_ink", 0),
        spirit_total=data.get("spirit_total", 30),
    )


def serialize_game(game: GameState) -> dict[str, Any]:
    return {
        "id": game.id,
        "phase": game.phase.value,
        "current_player": game.current_player,
        "turn": game.turn,
        "max_ink_cap": game.max_ink_cap,
        "hand_size": game.hand_size,
        "game_over": game.game_over,
        "winner": game.winner,
        "battlefield": {
            "p1": _side_to_dict(game.battlefield.p1_field),
            "p2": _side_to_dict(game.battlefield.p2_field),
        },
        "logs": [
            {
                "phase": entry.phase.value,
                "player": entry.player,
                "action": entry.action,
                "detail": entry.detail,
            }
            for entry in game.logs
        ],
    }


def deserialize_game(data: dict[str, Any]) -> GameState:
    game = GameState.__new__(GameState)
    game.id = data["id"]
    game.phase = Phase(data["phase"])
    game.current_player = data["current_player"]
    game.turn = data["turn"]
    game.max_ink_cap = data.get("max_ink_cap", 10)
    game.hand_size = data.get("hand_size", 5)
    game.game_over = data.get("game_over", False)
    game.winner = data.get("winner")
    bf = data.get("battlefield", {})
    game.battlefield = Battlefield(
        p1_field=_side_from_dict(bf.get("p1", {})),
        p2_field=_side_from_dict(bf.get("p2", {})),
    )
    game.logs = [
        GameLogEntry(
            phase=Phase(item["phase"]),
            player=item["player"],
            action=item["action"],
            detail=item.get("detail", ""),
        )
        for item in data.get("logs", [])
    ]
    return game


def serialize_room_meta(room: Any) -> dict[str, Any]:
    """Room = GameRoom dataclass from game_manager."""
    return {
        "match_id": room.match_id,
        "mode": room.mode,
        "p1_id": room.p1_id,
        "p2_id": room.p2_id,
        "p1_username": room.p1_username,
        "p2_username": room.p2_username,
        "p1_deck_id": room.p1_deck_id,
        "p2_deck_id": room.p2_deck_id,
        "p1_faction": room.p1_faction,
        "p2_faction": room.p2_faction,
        "match_started_at": room.match_started_at,
        "turn_deadline": room.turn_deadline,
        "game": serialize_game(room.game),
    }
