"""Faction synergy buffs for CampusKards v1."""
from __future__ import annotations

from typing import TYPE_CHECKING

from .local_synergy import compute_local_adjacent_bonus

if TYPE_CHECKING:
    from .game_engine import CardInstance, GameState

# Canonical faction codes from seed data
KEY_CLASS = "key_class"          # Elite: 2+ → +1 Power
ARTS_CLASS = "arts_class"        # Arts: 3+ → +1 Spirit
NORMAL_CLASS = "normal_class"    # Mass: 4+ → +1 Power +1 Spirit
INTL_CLASS = "intl_class"        # Global: 2+ intl + other → intl +1 Power, others +1 Spirit
COMPETITION_CLASS = "competition_class"  # Rush: 1+ rush + 2 attacks → +2 Power (temp)


def count_factions(units: list[CardInstance]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for unit in units:
        if not unit.faction or unit.faction == "neutral":
            continue
        counts[unit.faction] = counts.get(unit.faction, 0) + 1
    return counts


def _global_synergy_active(counts: dict[str, int]) -> bool:
    intl_count = counts.get(INTL_CLASS, 0)
    if intl_count < 2:
        return False
    return any(f != INTL_CLASS for f in counts)


def compute_unit_synergy(
    unit: CardInstance,
    counts: dict[str, int],
    *,
    attacks_this_turn: int,
) -> tuple[int, int, int, list[str]]:
    """Return (power_buff, grit_buff, spirit_buff, active_tags)."""
    faction = unit.faction
    power = grit = spirit = 0
    tags: list[str] = []

    if faction == KEY_CLASS and counts.get(KEY_CLASS, 0) >= 2:
        power += 1
        tags.append("elite_synergy")

    if faction == ARTS_CLASS and counts.get(ARTS_CLASS, 0) >= 3:
        spirit += 1
        tags.append("arts_synergy")

    if faction == NORMAL_CLASS and counts.get(NORMAL_CLASS, 0) >= 4:
        power += 1
        spirit += 1
        tags.append("mass_synergy")

    if _global_synergy_active(counts):
        if faction == INTL_CLASS:
            power += 1
            tags.append("global_synergy")
        else:
            spirit += 1
            if "global_synergy" not in tags:
                tags.append("global_synergy")

    if (
        faction == COMPETITION_CLASS
        and counts.get(COMPETITION_CLASS, 0) >= 1
        and attacks_this_turn >= 2
    ):
        power += 2
        tags.append("rush_synergy")

    return power, grit, spirit, tags


def apply_synergies_for_player(game: GameState, player: int) -> None:
    side = game.battlefield.side_for(player)
    units = side.all_units
    counts = count_factions(units)
    attacks = game.attacks_this_turn.get(player, 0)

    for unit in units:
        p, g, s, tags = compute_unit_synergy(unit, counts, attacks_this_turn=attacks)
        local_p, local_tags = compute_local_adjacent_bonus(unit, side)
        tags = tags + local_tags
        unit.apply_synergy_buffs(p, g, s, tags, local_power=local_p)


def apply_all_synergies(game: GameState) -> None:
    for player in (1, 2):
        apply_synergies_for_player(game, player)
    from .faction_passives import apply_faction_stat_passives

    for player in (1, 2):
        apply_faction_stat_passives(game, player)
