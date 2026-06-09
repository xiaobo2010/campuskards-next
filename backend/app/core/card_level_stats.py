"""Apply collection card level bonuses to battle deck instances."""
from __future__ import annotations

DEFAULT_GROWTH = {"power": 1, "grit": 0, "spirit": 1}

STAT_GROWTH: dict[str, dict[str, int]] = {
    "INFANTRY": {"power": 1, "grit": 0, "spirit": 1},
    "TANK": {"power": 0, "grit": 1, "spirit": 2},
    "ARTILLERY": {"power": 1, "grit": 0, "spirit": 0},
    "FIGHTER": {"power": 1, "grit": 0, "spirit": 1},
    "BOMBER": {"power": 1, "grit": 0, "spirit": 0},
    "student": {"power": 1, "grit": 0, "spirit": 1},
    "teacher": {"power": 1, "grit": 1, "spirit": 1},
}


# Build a case-insensitive lookup for unit type growth
_NORMALIZED_GROWTH: dict[str, dict[str, int]] = {
    k.lower(): v for k, v in STAT_GROWTH.items()
}


def apply_level_to_card_dict(card: dict, *, level: int, unit_type: str | None = None) -> dict:
    """Mutate card dict with scaled stats for level > 1."""
    if level <= 1:
        return card
    ut_lower = (unit_type or "").lower()
    growth = _NORMALIZED_GROWTH.get(ut_lower, DEFAULT_GROWTH)
    delta = level - 1
    card = dict(card)
    card["power"] = (card.get("power") or 0) + growth["power"] * delta
    card["grit"] = (card.get("grit") or 0) + growth["grit"] * delta
    card["spirit"] = (card.get("spirit") or 1) + growth["spirit"] * delta
    card["level"] = level
    return card


def elo_bonus_max_ink(elo: int) -> int:
    """ELO ≥ 2000: +1 max ink per 200 ELO above threshold."""
    if elo < 2000:
        return 0
    return (elo - 2000) // 200
