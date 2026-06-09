"""Serialize / deserialize GameState and active room metadata for Redis."""
from __future__ import annotations

from typing import Any

from .battlefield import Battlefield, PlayerField
from .effect_choices import ChoiceOption, PendingResolution
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
        "effect_text": card.effect_text,
        "effect_code": card.effect_code,
        "unit_type": card.unit_type,
        "keywords": sorted(card.keywords),
        "synergy_tags": card.synergy_tags,
        "base_power": card.base_power,
        "base_grit": card.base_grit,
        "base_spirit": card.base_spirit,
        "_synergy_power": card._synergy_power,
        "_synergy_grit": card._synergy_grit,
        "_synergy_spirit_bonus": card._synergy_spirit_bonus,
        "_local_synergy_power": card._local_synergy_power,
        "_temp_power": card._temp_power,
        "_temp_grit": card._temp_grit,
        "_temp_spirit": card._temp_spirit,
        "summoned_this_turn": card.summoned_this_turn,
        "subtype": card.subtype,
        "immune_turns": card.immune_turns,
        "silenced_turns": card.silenced_turns,
        "cannot_attack_turns": card.cannot_attack_turns,
        "controlled_by": card.controlled_by,
        "controlled_until_turn": card.controlled_until_turn,
        "_faction_passive_power": card._faction_passive_power,
        "_perm_power_mod": card._perm_power_mod,
    }


def _card_from_dict(data: dict[str, Any]) -> CardInstance:
    card = CardInstance(
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
        effect_text=data.get("effect_text", ""),
        effect_code=data.get("effect_code", ""),
        unit_type=data.get("unit_type", "melee"),
        keywords=set(data.get("keywords", [])),
        synergy_tags=data.get("synergy_tags", []),
        base_power=data.get("base_power", data.get("power", 0)),
        base_grit=data.get("base_grit", data.get("grit", 0)),
        base_spirit=data.get("base_spirit", data.get("spirit", 1)),
        summoned_this_turn=data.get("summoned_this_turn", False),
        subtype=data.get("subtype", ""),
    )
    card.immune_turns = data.get("immune_turns", 0)
    card.silenced_turns = data.get("silenced_turns", 0)
    card.cannot_attack_turns = data.get("cannot_attack_turns", 0)
    card.controlled_by = data.get("controlled_by")
    card.controlled_until_turn = data.get("controlled_until_turn", 0)
    card._faction_passive_power = data.get("_faction_passive_power", 0)
    card._perm_power_mod = data.get("_perm_power_mod", 0)
    card._synergy_power = data.get("_synergy_power", 0)
    card._synergy_grit = data.get("_synergy_grit", 0)
    card._synergy_spirit_bonus = data.get("_synergy_spirit_bonus", 0)
    card._local_synergy_power = data.get("_local_synergy_power", 0)
    card._temp_power = data.get("_temp_power", 0)
    card._temp_grit = data.get("_temp_grit", 0)
    card._temp_spirit = data.get("_temp_spirit", 0)
    return card


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
        "traps": [_card_to_dict(u) for u in side.traps],
        "advisor_units": [_card_to_dict(u) for u in side.advisor_units],
    }


def _side_from_dict(data: dict[str, Any]) -> PlayerField:
    side = PlayerField(
        front_line=_cards_from_list(data.get("front_line", [])),
        support_line=_cards_from_list(data.get("support_line", [])),
        hand=_cards_from_list(data.get("hand", [])),
        deck=_cards_from_list(data.get("deck", [])),
        graveyard=_cards_from_list(data.get("graveyard", [])),
        ink=data.get("ink", 0),
        max_ink=data.get("max_ink", 0),
        spirit_total=data.get("spirit_total", 30),
    )
    side.traps = _cards_from_list(data.get("traps", []))
    side.advisor_units = _cards_from_list(data.get("advisor_units", []))
    return side


def _pending_to_dict(pr: PendingResolution) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "player": pr.player,
        "context": pr.context,
        "options": [
            {"id": o.id, "label": o.label, "branch_text": o.branch_text}
            for o in pr.options
        ],
        "target_uid": pr.target_uid,
        "deploy_line": pr.deploy_line,
        "deploy_slot": pr.deploy_slot,
        "discard_count": pr.discard_count,
    }
    if pr.card:
        payload["card"] = _card_to_dict(pr.card)
    return payload


def _pending_from_dict(data: dict[str, Any]) -> PendingResolution:
    card_data = data.get("card")
    return PendingResolution(
        player=data["player"],
        card=_card_from_dict(card_data) if card_data else None,
        context=data["context"],
        options=[
            ChoiceOption(id=o["id"], label=o["label"], branch_text=o["branch_text"])
            for o in data.get("options", [])
        ],
        target_uid=data.get("target_uid"),
        deploy_line=data.get("deploy_line"),
        deploy_slot=data.get("deploy_slot"),
        discard_count=data.get("discard_count", 0),
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
        "starting_hp": game.starting_hp,
        "attacks_this_turn": game.attacks_this_turn,
        "commands_played_this_turn": game.commands_played_this_turn,
        "commands_played_before_current": game.commands_played_before_current,
        "cost_reduction_next": game.cost_reduction_next,
        "corridor_controller": game.corridor_controller,
        "arts_command_discount_used": game.arts_command_discount_used,
        "cards_played_this_turn": game.cards_played_this_turn,
        "reactive_counters": game.reactive_counters,
        "pending_resolution": (
            _pending_to_dict(game.pending_resolution)
            if game.pending_resolution
            else None
        ),
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
    game.starting_hp = {int(k): v for k, v in data.get("starting_hp", {1: 30, 2: 30}).items()}
    game.attacks_this_turn = {int(k): v for k, v in data.get("attacks_this_turn", {1: 0, 2: 0}).items()}
    game.commands_played_this_turn = {int(k): v for k, v in data.get("commands_played_this_turn", {1: 0, 2: 0}).items()}
    game.commands_played_before_current = {
        int(k): v for k, v in data.get("commands_played_before_current", {1: 0, 2: 0}).items()
    }
    game.cost_reduction_next = {int(k): v for k, v in data.get("cost_reduction_next", {1: 0, 2: 0}).items()}
    game.corridor_controller = data.get("corridor_controller")
    game.arts_command_discount_used = {
        int(k): v for k, v in data.get("arts_command_discount_used", {1: False, 2: False}).items()
    }
    game.cards_played_this_turn = {int(k): v for k, v in data.get("cards_played_this_turn", {1: 0, 2: 0}).items()}
    game.reactive_counters = data.get("reactive_counters", {})
    pending_data = data.get("pending_resolution")
    game.pending_resolution = (
        _pending_from_dict(pending_data) if pending_data else None
    )
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
        "finalized": getattr(room, "_finalized", False),
        "bot_difficulty": getattr(room, "bot_difficulty", None),
        "game": serialize_game(room.game),
    }
