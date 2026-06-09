"""Heuristic AI for PVE practice — produces legal engine actions."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.core.game_engine import GameState, Phase, is_spell_card, is_unit_card

ActionKind = Literal[
    "play_card",
    "attack",
    "end_turn",
    "begin_combat",
    "resolve_choice",
    "resolve_discard",
]


@dataclass
class BotAction:
    kind: ActionKind
    card_uid: str | None = None
    position: str = "front"
    slot: int | None = None
    target_id: str | None = None
    attacker_ids: list[str] | None = None
    choice_id: str | None = None
    card_uids: list[str] | None = None


def decide_bot_actions(game: GameState, bot_player: int) -> list[BotAction]:
    """Return a sequence of actions for the bot's current turn."""
    if game.game_over or game.current_player != bot_player:
        return []

    pending = _pending_action(game, bot_player)
    if pending:
        return [pending]

    actions: list[BotAction] = []
    actions.extend(_main_phase_actions(game, bot_player))

    if game.phase == Phase.MAIN:
        actions.append(BotAction(kind="begin_combat"))

    actions.extend(_combat_actions(game, bot_player))
    actions.append(BotAction(kind="end_turn"))
    return actions


def _pending_action(game: GameState, bot_player: int) -> BotAction | None:
    pr = game.pending_resolution
    if not pr or pr.player != bot_player:
        return None
    if pr.context == "discard" and pr.discard_count > 0:
        side = game.battlefield.side_for(bot_player)
        picks = sorted(side.hand, key=lambda c: c.cost, reverse=True)[: pr.discard_count]
        return BotAction(
            kind="resolve_discard",
            card_uids=[c.uid for c in picks],
        )
    if pr.options:
        choice = pr.options[0]
        return BotAction(
            kind="resolve_choice",
            choice_id=choice.id,
            target_id=pr.target_uid,
        )
    return None


def _main_phase_actions(game: GameState, bot_player: int) -> list[BotAction]:
    actions: list[BotAction] = []
    safety = 0
    while game.phase == Phase.MAIN and game.current_player == bot_player and safety < 20:
        safety += 1
        if game.pending_resolution:
            break
        play = _best_deploy_or_spell(game, bot_player)
        if not play:
            break
        actions.append(play)
    return actions


def _best_deploy_or_spell(game: GameState, bot_player: int) -> BotAction | None:
    side = game.battlefield.side_for(bot_player)
    ink = side.ink

    units = [
        c
        for c in side.hand
        if is_unit_card(c.card_type) and game._effective_cost(c, bot_player) <= ink
    ]
    units.sort(key=lambda c: (-c.power, -c.spirit, c.cost))

    for card in units:
        line, slot = _pick_deploy_slot(side, card)
        if line is None:
            continue
        return BotAction(
            kind="play_card",
            card_uid=card.uid,
            position=line,
            slot=slot,
        )

    spells = [
        c
        for c in side.hand
        if is_spell_card(c.card_type) and game._effective_cost(c, bot_player) <= ink
    ]
    spells.sort(key=lambda c: (-c.cost, -c.power))
    if spells:
        card = spells[0]
        return BotAction(
            kind="play_card",
            card_uid=card.uid,
            position="front",
            target_id=_default_spell_target(game, bot_player, card.uid),
        )
    return None


def _pick_deploy_slot(side, card) -> tuple[str | None, int | None]:
    """Prefer front line for high-power units, support for low-cost fillers."""
    front_room = max(0, 5 - len(side.front_line))
    support_room = max(0, 4 - len(side.support_line))
    prefer_front = card.power >= 3 or card.cost >= 4

    if prefer_front and front_room > 0:
        return "front", len(side.front_line)
    if support_room > 0:
        return "support", len(side.support_line)
    if front_room > 0:
        return "front", len(side.front_line)
    return None, None


def _default_spell_target(game: GameState, bot_player: int, card_uid: str) -> str | None:
    side = game.battlefield.side_for(bot_player)
    card = game._find_in_list(side.hand, card_uid)
    if not card:
        return None
    opp = game.battlefield.opponent_side(bot_player)
    if opp.all_units:
        return max(opp.all_units, key=lambda u: u.spirit).uid
    return None


def _combat_actions(game: GameState, bot_player: int) -> list[BotAction]:
    if game.phase != Phase.COMBAT:
        return []

    side = game.battlefield.side_for(bot_player)
    opp = game.battlefield.opponent_side(bot_player)
    actions: list[BotAction] = []

    attackers = [
        u
        for u in side.all_units
        if u.alive and u.can_attack and not u.has_attacked
    ]
    attackers.sort(key=lambda u: -u.power)

    for unit in attackers:
        target = _pick_attack_target(game, bot_player, unit.uid, opp)
        actions.append(
            BotAction(
                kind="attack",
                attacker_ids=[unit.uid],
                target_id=target,
            )
        )
    return actions


def _pick_attack_target(
    game: GameState,
    bot_player: int,
    attacker_uid: str,
    opp,
) -> str | None:
    """Target weakest legal enemy unit, else face (None)."""
    from app.core.combat_rules import can_attack_target

    side = game.battlefield.side_for(bot_player)
    attacker = game._find_in_list(side.all_units, attacker_uid)
    if not attacker:
        return None

    valid_targets = [
        u for u in opp.all_units
        if u.alive and can_attack_target(attacker, u, opp)
    ]
    if valid_targets:
        return min(valid_targets, key=lambda u: u.spirit).uid
    return None
