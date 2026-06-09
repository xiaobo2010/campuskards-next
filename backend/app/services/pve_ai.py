"""Heuristic AI for PVE practice — produces legal engine actions."""
from __future__ import annotations

import random
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


def elo_to_difficulty(elo: int) -> str:
    if elo < 800:
        return "easy"
    if elo < 1200:
        return "medium"
    if elo < 1600:
        return "hard"
    return "expert"


def decide_bot_actions(
    game: GameState, bot_player: int, difficulty: str = "medium"
) -> list[BotAction]:
    """Return a sequence of actions for the bot's current turn."""
    if game.game_over or game.current_player != bot_player:
        return []

    pending = _pending_action(game, bot_player, difficulty)
    if pending:
        return [pending]

    actions: list[BotAction] = []
    actions.extend(_main_phase_actions(game, bot_player, difficulty))

    if game.phase == Phase.MAIN:
        actions.append(BotAction(kind="begin_combat"))

    actions.extend(_combat_actions(game, bot_player, difficulty))
    actions.append(BotAction(kind="end_turn"))
    return actions


def _pending_action(
    game: GameState, bot_player: int, difficulty: str
) -> BotAction | None:
    pr = game.pending_resolution
    if not pr or pr.player != bot_player:
        return None
    if pr.context == "discard" and pr.discard_count > 0:
        side = game.battlefield.side_for(bot_player)
        if difficulty == "easy":
            picks = sorted(side.hand, key=lambda c: c.cost)[: pr.discard_count]
        else:
            picks = sorted(
                side.hand, key=lambda c: c.cost, reverse=True
            )[: pr.discard_count]
        return BotAction(
            kind="resolve_discard",
            card_uids=[c.uid for c in picks],
        )
    if pr.options:
        if difficulty in ("hard", "expert") and len(pr.options) > 1:
            choice = _pick_best_choice(game, bot_player, pr.options, difficulty)
        else:
            choice = pr.options[0]
        return BotAction(
            kind="resolve_choice",
            choice_id=choice.id,
            target_id=pr.target_uid,
        )
    return None


def _main_phase_actions(
    game: GameState, bot_player: int, difficulty: str
) -> list[BotAction]:
    actions: list[BotAction] = []
    safety = 0
    while (
        game.phase == Phase.MAIN
        and game.current_player == bot_player
        and safety < 20
    ):
        safety += 1
        if game.pending_resolution:
            break
        play = _best_deploy_or_spell(game, bot_player, difficulty)
        if not play:
            break
        actions.append(play)
    return actions


def _best_deploy_or_spell(
    game: GameState, bot_player: int, difficulty: str
) -> BotAction | None:
    side = game.battlefield.side_for(bot_player)
    ink = side.ink

    playable_units = [
        c
        for c in side.hand
        if is_unit_card(c.card_type)
        and game._effective_cost(c, bot_player) <= ink
    ]

    if not playable_units:
        return _try_spell(game, bot_player, difficulty)

    if difficulty == "easy":
        if random.random() < 0.3:
            return None
        card = random.choice(playable_units)
        line, slot = _pick_deploy_slot(side, card)
        if line is None:
            return _try_spell(game, bot_player, difficulty)
        return BotAction(
            kind="play_card", card_uid=card.uid, position=line, slot=slot
        )

    playable_units.sort(key=lambda c: _unit_score(c, side), reverse=True)

    if difficulty in ("hard", "expert"):
        for card in playable_units:
            if _should_save_for_synergy(card, side):
                continue
            line, slot = _pick_deploy_slot(side, card)
            if line is None:
                continue
            return BotAction(
                kind="play_card", card_uid=card.uid, position=line, slot=slot
            )
    else:
        for card in playable_units:
            line, slot = _pick_deploy_slot(side, card)
            if line is None:
                continue
            return BotAction(
                kind="play_card", card_uid=card.uid, position=line, slot=slot
            )

    return _try_spell(game, bot_player, difficulty)


def _should_save_for_synergy(card, side) -> bool:
    """Hard/expert: defer a card if it would trigger synergy next turn."""
    if not card.faction:
        return False
    same_faction = [u for u in side.all_units if u.faction == card.faction]
    if len(same_faction) >= 2:
        return False
    return False


def _unit_score(card, side) -> int:
    score = card.power * 2 + card.spirit
    if card.faction:
        same = sum(1 for u in side.all_units if u.faction == card.faction)
        if same >= 1:
            score += 3
    return score


def _pick_deploy_slot(side, card) -> tuple[str | None, int | None]:
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


def _try_spell(
    game: GameState, bot_player: int, difficulty: str
) -> BotAction | None:
    side = game.battlefield.side_for(bot_player)
    ink = side.ink

    spells = [
        c
        for c in side.hand
        if is_spell_card(c.card_type)
        and game._effective_cost(c, bot_player) <= ink
    ]
    if not spells:
        return None

    if difficulty == "easy":
        if random.random() < 0.5:
            return None
        card = random.choice(spells)
        return BotAction(
            kind="play_card",
            card_uid=card.uid,
            position="front",
            target_id=_spell_target(game, bot_player, card.uid, difficulty),
        )

    if difficulty in ("hard", "expert"):
        spells.sort(key=lambda c: (-c.cost, -c.power))
        for card in spells:
            target = _spell_target(game, bot_player, card.uid, difficulty)
            if target:
                return BotAction(
                    kind="play_card",
                    card_uid=card.uid,
                    position="front",
                    target_id=target,
                )
        return None

    spells.sort(key=lambda c: (-c.cost, -c.power))
    card = spells[0]
    target = _default_spell_target(game, bot_player, card.uid)
    return BotAction(kind="play_card", card_uid=card.uid, position="front", target_id=target)


def _spell_target(
    game: GameState, bot_player: int, card_uid: str, difficulty: str
) -> str | None:
    if difficulty in ("hard", "expert"):
        return _high_value_spell_target(game, bot_player, card_uid, difficulty)
    return _default_spell_target(game, bot_player, card_uid)


def _high_value_spell_target(
    game: GameState, bot_player: int, card_uid: str, difficulty: str
) -> str | None:
    side = game.battlefield.side_for(bot_player)
    card = game._find_in_list(side.hand, card_uid)
    if not card:
        return None
    opp = game.battlefield.opponent_side(bot_player)
    if not opp.all_units:
        return None
    if difficulty == "expert":
        return max(opp.all_units, key=lambda u: u.power * 2 + u.spirit).uid
    return max(opp.all_units, key=lambda u: u.power).uid


def _default_spell_target(
    game: GameState, bot_player: int, card_uid: str
) -> str | None:
    side = game.battlefield.side_for(bot_player)
    card = game._find_in_list(side.hand, card_uid)
    if not card:
        return None
    opp = game.battlefield.opponent_side(bot_player)
    if opp.all_units:
        return max(opp.all_units, key=lambda u: u.spirit).uid
    return None


def _combat_actions(
    game: GameState, bot_player: int, difficulty: str
) -> list[BotAction]:
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

    if difficulty == "easy":
        random.shuffle(attackers)
        for unit in attackers:
            if random.random() < 0.4:
                continue
            target = _pick_attack_target(
                game, bot_player, unit.uid, opp, difficulty
            )
            actions.append(
                BotAction(kind="attack", attacker_ids=[unit.uid], target_id=target)
            )
        return actions

    if difficulty in ("hard", "expert"):
        prime = _find_prime_target(attackers, game, bot_player, opp, difficulty)
        prime_uid = prime.uid if prime else None
        for unit in attackers:
            target = _pick_attack_target(
                game, bot_player, unit.uid, opp, difficulty, focus_uid=prime_uid
            )
            actions.append(
                BotAction(kind="attack", attacker_ids=[unit.uid], target_id=target)
            )
        return actions

    for unit in attackers:
        target = _pick_attack_target(game, bot_player, unit.uid, opp, difficulty)
        actions.append(
            BotAction(kind="attack", attacker_ids=[unit.uid], target_id=target)
        )
    return actions


def _find_prime_target(attackers, game, bot_player, opp, difficulty: str):
    from app.core.combat_rules import can_attack_target

    side = game.battlefield.side_for(bot_player)
    candidates = []
    for u in opp.all_units:
        if not u.alive:
            continue
        for attacker_card in attackers:
            card = game._find_in_list(side.all_units, attacker_card.uid)
            if card and can_attack_target(card, u, opp):
                candidates.append(u)
                break
    if not candidates:
        return None
    if difficulty == "expert":
        return max(candidates, key=lambda u: u.power * 2 + u.spirit)
    return max(candidates, key=lambda u: u.power)


def _pick_attack_target(
    game: GameState,
    bot_player: int,
    attacker_uid: str,
    opp,
    difficulty: str,
    focus_uid: str | None = None,
) -> str | None:
    from app.core.combat_rules import can_attack_target

    side = game.battlefield.side_for(bot_player)
    attacker = game._find_in_list(side.all_units, attacker_uid)
    if not attacker:
        return None

    valid_targets = [
        u
        for u in opp.all_units
        if u.alive and can_attack_target(attacker, u, opp)
    ]

    if difficulty == "easy":
        if valid_targets:
            return random.choice(valid_targets).uid
        return None

    if focus_uid and any(u.uid == focus_uid for u in valid_targets):
        return focus_uid

    if difficulty in ("hard", "expert"):
        if valid_targets:
            if difficulty == "expert":
                return max(valid_targets, key=lambda u: u.power * 2 + u.spirit).uid
            return max(valid_targets, key=lambda u: u.power).uid

    if valid_targets:
        return min(valid_targets, key=lambda u: u.spirit).uid
    return None


def _pick_best_choice(game, bot_player, options, difficulty: str):
    if difficulty == "expert":
        side = game.battlefield.side_for(bot_player)
        if side.spirit_total <= 10:
            defensive = [
                o
                for o in options
                if "heal" in o.label.lower()
                or "shield" in o.label.lower()
                or "defense" in o.label.lower()
            ]
            if defensive:
                return defensive[0]
    return options[0]
