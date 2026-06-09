"""Faction passive abilities applied during battle."""
from __future__ import annotations

from typing import TYPE_CHECKING

from .faction_synergy import (
    ARTS_CLASS,
    COMPETITION_CLASS,
    INTL_CLASS,
    KEY_CLASS,
    NORMAL_CLASS,
)

if TYPE_CHECKING:
    from .game_engine import CardInstance, GameState


def apply_turn_start_passives(game: GameState, player: int) -> None:
    """Passives that fire at the start of a player's turn."""
    side = game.battlefield.side_for(player)
    game.arts_command_discount_used[player] = False

    # 国际班：手牌≥5 → 本回合 +1 墨水
    intl_units = sum(1 for u in side.all_units if u.faction == INTL_CLASS)
    if intl_units > 0 and len(side.hand) >= 5:
        side.ink += 1
        game._log(player, "faction_passive", "intl_class: +1 ink (hand≥5)")

    apply_faction_stat_passives(game, player)


def apply_faction_stat_passives(game: GameState, player: int) -> None:
    """Ongoing stat passives from faction identity."""
    side = game.battlefield.side_for(player)
    units = side.all_units

    normal_count = sum(1 for u in units if u.faction == NORMAL_CLASS)
    normal_bonus = min(3, normal_count) if normal_count else 0

    comp_count = sum(1 for u in units if u.faction == COMPETITION_CLASS)
    comp_bonus = 2 if 0 < comp_count <= 2 else 0

    for unit in units:
        extra_power = 0
        if unit.faction == NORMAL_CLASS and normal_bonus:
            extra_power += normal_bonus
        if unit.faction == COMPETITION_CLASS and comp_bonus:
            extra_power += comp_bonus
        unit._faction_passive_power = extra_power
        unit._refresh_effective_stats()


def arts_first_command_discount(game: GameState, player: int, card: CardInstance) -> int:
    """艺体班：本回合第一张命令卡 -1 费用。"""
    if card.card_type not in ("command", "event"):
        return 0
    side = game.battlefield.side_for(player)
    has_arts = any(u.faction == ARTS_CLASS for u in side.all_units)
    if not has_arts or game.arts_command_discount_used.get(player, False):
        return 0
    return 1


def mark_arts_command_discount_used(game: GameState, player: int, card: CardInstance) -> None:
    if card.card_type in ("command", "event"):
        side = game.battlefield.side_for(player)
        if any(u.faction == ARTS_CLASS for u in side.all_units):
            game.arts_command_discount_used[player] = True


def key_class_damage_reduction(defender: CardInstance, incoming: int, attacker_power: int) -> int:
    """重点班被动：防御≥攻击时战斗伤害 -1。"""
    if defender.faction != KEY_CLASS or incoming <= 0:
        return incoming
    if defender.grit >= attacker_power:
        return max(0, incoming - 1)
    return incoming
