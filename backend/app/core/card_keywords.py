"""Parse card ability text into keywords and unit types."""
from __future__ import annotations

import re

KEYWORD_PATTERNS: dict[str, re.Pattern[str]] = {
    "charge": re.compile(r"冲锋"),
    "ranged": re.compile(r"远程"),
    "flying": re.compile(r"飞行"),
    "first_strike": re.compile(r"先攻"),
    "pierce": re.compile(r"穿透"),
}

RANGED_SUBTYPES = frozenset({"broadcast", "sports"})


def parse_keywords(effect_text: str) -> set[str]:
    text = effect_text or ""
    return {name for name, pattern in KEYWORD_PATTERNS.items() if pattern.search(text)}


def infer_unit_type(keywords: set[str], subtype: str | None = None) -> str:
    if "flying" in keywords:
        return "flying"
    if "ranged" in keywords or (subtype and subtype in RANGED_SUBTYPES):
        return "ranged"
    return "melee"


def has_on_deploy(effect_text: str) -> bool:
    return bool(re.search(r"出场时", effect_text or ""))


def has_on_death(effect_text: str) -> bool:
    return bool(re.search(r"亡语", effect_text or ""))


def has_active_ability(effect_text: str) -> bool:
    return bool(re.search(r"主动[:：]|激活[:：]", effect_text or ""))
