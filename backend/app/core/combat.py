"""Combat resolution logic for CampusKards."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CombatResult:
    """Result of a single attack interaction."""
    attacker_survived: bool = True
    defender_survived: bool = True
    damage_to_defender_hp: int = 0
    damage_to_attacker_hp: int = 0


def resolve_attack(
    attacker_power: int,
    defender_grit: int,
    attacker_spirit: int,
    defender_spirit: int,
) -> CombatResult:
    """Resolve a single attack.

    Rules:
      - effective_damage = max(0, attacker_power - defender_grit)
      - If effective_damage == 0: defender survives, no damage
      - If 0 < effective_damage < defender_spirit: defender survives, takes damage
      - If effective_damage >= defender_spirit: defender dies
    """
    effective_damage = max(0, attacker_power - defender_grit)

    if effective_damage == 0:
        return CombatResult(
            attacker_survived=True,
            defender_survived=True,
            damage_to_defender_hp=0,
            damage_to_attacker_hp=0,
        )

    if effective_damage < defender_spirit:
        return CombatResult(
            attacker_survived=True,
            defender_survived=True,
            damage_to_defender_hp=effective_damage,
            damage_to_attacker_hp=0,
        )

    # Defender dies
    return CombatResult(
        attacker_survived=True,
        defender_survived=False,
        damage_to_defender_hp=defender_spirit,
        damage_to_attacker_hp=0,
    )


def compute_overflow(attacker_power: int, defender_grit: int, defender_spirit: int) -> int:
    """How much damage goes to player face after killing a unit."""
    effective = max(0, attacker_power - defender_grit)
    return max(0, effective - defender_spirit)
