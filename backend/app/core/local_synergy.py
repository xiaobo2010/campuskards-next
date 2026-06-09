"""Adjacent same-faction local synergy (邻位协同)."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .game_engine import CardInstance
    from .battlefield import PlayerField

LOCAL_POWER_BONUS = 1


def _same_faction(a: str, b: str) -> bool:
    if not a or not b or a == "neutral" or b == "neutral":
        return False
    return a == b


def has_adjacent_same_faction(unit: CardInstance, line: list[CardInstance], index: int) -> bool:
    """True if a same-faction ally is in an adjacent slot on the same line."""
    if not unit.faction or unit.faction == "neutral":
        return False
    for ni in (index - 1, index + 1):
        if 0 <= ni < len(line):
            neighbor = line[ni]
            if neighbor.alive and _same_faction(unit.faction, neighbor.faction):
                return True
    return False


def compute_local_adjacent_bonus(
    unit: CardInstance,
    side: PlayerField,
) -> tuple[int, list[str]]:
    """Return (+power, tags) from adjacent same-faction allies."""
    for line in (side.front_line, side.support_line):
        if unit not in line:
            continue
        idx = line.index(unit)
        if has_adjacent_same_faction(unit, line, idx):
            return LOCAL_POWER_BONUS, ["adjacent_synergy"]
    return 0, []


def count_adjacent_links(side: PlayerField) -> int:
    """Count undirected adjacent same-faction pairs (for UI stats)."""
    links = 0
    for line in (side.front_line, side.support_line):
        for i in range(len(line) - 1):
            if _same_faction(line[i].faction, line[i + 1].faction):
                links += 1
    return links
