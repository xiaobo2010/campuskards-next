"""Combat targeting and damage rules."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .battlefield import PlayerField
    from .game_engine import CardInstance

from .faction_passives import key_class_damage_reduction


def can_attack_target(
    attacker: CardInstance,
    defender: CardInstance,
    opponent: PlayerField,
) -> bool:
    if defender in opponent.support_line and opponent.front_line:
        if attacker.unit_type == "flying" or "flying" in attacker.keywords:
            return True
        if "pierce" in attacker.keywords:
            return True
        if attacker.unit_type == "ranged" or "ranged" in attacker.keywords:
            return True
        if attacker.unit_type == "melee" and "ranged" not in attacker.keywords:
            return False
    return True


def apply_combat_damage_to_unit(
    unit: CardInstance,
    amount: int,
    *,
    attacker_power: int = 0,
    is_combat: bool = True,
) -> int:
    if amount <= 0:
        return 0
    if unit.immune_turns > 0:
        return 0
    if is_combat and attacker_power:
        amount = key_class_damage_reduction(unit, amount, attacker_power)
    return unit.take_damage(amount)
