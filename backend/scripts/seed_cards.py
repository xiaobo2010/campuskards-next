#!/usr/bin/env python3
"""Seed script: import factions + cards from card-data.json into the database.

Supports upsert: existing records are updated, new ones are created.
Can be used both as CLI tool and imported as a library by admin API.
"""
import asyncio
import json
import sys
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

# Allow running as script from scripts/ directory
if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import async_session
from app.models import Card, Faction

# Field mapping: JSON key -> Card model attribute
CARD_FIELD_MAP = {
    "id": "id",
    "name": "name",
    "faction": "faction_code",
    "faction_code": "faction_code",
    "type": "card_type",
    "card_type": "card_type",
    "subtype": "unit_type",
    "unit_type": "unit_type",
    "cost": "cost",
    "attack": "power",
    "power": "power",
    "defense": "grit",
    "grit": "grit",
    "hp": "spirit",
    "spirit": "spirit",
    "ability": "effect_text",
    "effect_text": "effect_text",
    "rarity": "rarity",
    "flavor": "flavor_text",
    "flavor_text": "flavor_text",
}

# Card type mapping: JSON type values -> DB card_type enum
CARD_TYPE_MAP = {
    "unit": "character",
    "command": "event",
    "counter": "snitch",
    "buff": "event",
}

# Faction mapping: JSON faction fields -> Faction model attributes
FACTION_FIELD_MAP = {
    "id": "code",
    "name": "name",
    "passive": "ability_text",
    "style": "play_style",
}

# Default faction colors (will be used when JSON doesn't provide them)
FACTION_COLORS = {
    "key_class": ("#eab308", "#facc15"),
    "arts_class": ("#a855f7", "#c084fc"),
    "normal_class": ("#6366f1", "#818cf8"),
    "intl_class": ("#3b82f6", "#60a5fa"),
    "competition_class": ("#ef4444", "#f87171"),
    "neutral": ("#6b7280", "#9ca3af"),
    "lab_class": ("#22c55e", "#4ade80"),
    "pe_class": ("#f97316", "#fb923c"),
    "art_class": ("#a855f7", "#c084fc"),
    "office": ("#3b82f6", "#60a5fa"),
}


def transform_card(raw: dict) -> dict:
    """Transform a card-data.json card dict to match the Card model."""
    card = {}
    for json_key, model_key in CARD_FIELD_MAP.items():
        if json_key in raw:
            val = raw[json_key]
            if json_key == "type":
                val = CARD_TYPE_MAP.get(val, val)
            card[model_key] = val
    card.setdefault("name_en", "")
    card.setdefault("effect_code", "")
    card.setdefault("set_code", "S1")
    card.setdefault("is_token", False)
    card.setdefault("artist", "")
    return card


def transform_faction(raw: dict) -> dict:
    """Transform a card-data.json faction dict to match the Faction model."""
    faction = {}
    for json_key, model_key in FACTION_FIELD_MAP.items():
        if json_key in raw:
            faction[model_key] = raw[json_key]
    code = faction.get("code", "")
    colors = FACTION_COLORS.get(code, ("#6366f1", "#818cf8"))
    passive = raw.get("passive", "")
    if "：" in passive:
        ab_name = passive.split("：")[0]
    elif ":" in passive:
        ab_name = passive.split(":")[0]
    else:
        ab_name = passive[:64] if passive else ""
    faction.setdefault("ability_name", ab_name[:64])
    faction.setdefault("color_primary", colors[0])
    faction.setdefault("color_secondary", colors[1])
    faction.setdefault("icon_url", None)
    return faction


async def seed(db: AsyncSession | None = None, json_path: str | None = None, data: dict | None = None) -> dict:
    """Upsert factions + cards from card-data.json into database.

    Args:
        db: Optional async session (creates one if None).
        json_path: Path to card-data.json (used when data is None).
        data: Pre-parsed JSON dict (used when json_path is None).

    Returns:
        dict with keys: factions_inserted, cards_inserted, cards_updated, total_cards
    """
    if data is None:
        if json_path is None:
            return {"error": "必须提供 json_path 或 data"}
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

    factions_inserted = 0
    cards_inserted = 0
    cards_updated = 0

    raw_factions = list(data.get("factions", []))
    # Ensure neutral faction exists
    if not any(rf.get("id") == "neutral" for rf in raw_factions):
        raw_factions.append({"id": "neutral", "name": "中立", "passive": "", "style": "无阵营中立卡", "mechanic": ""})

    if db is None:
        async with async_session() as session:
            return await _do_seed(session, raw_factions, data.get("cards", []))
    else:
        return await _do_seed(db, raw_factions, data.get("cards", []))


async def _do_seed(db: AsyncSession, raw_factions: list[dict], raw_cards: list[dict]) -> dict:
    factions_inserted = 0
    cards_inserted = 0
    cards_updated = 0

    for rf in raw_factions:
        fd = transform_faction(rf)
        code = fd["code"]
        result = await db.execute(sa.select(Faction).where(Faction.code == code))
        existing = result.scalar_one_or_none()
        if not existing:
            faction = Faction(**fd)
            db.add(faction)
            factions_inserted += 1
        else:
            for k, v in fd.items():
                if k != "code" and hasattr(existing, k):
                    setattr(existing, k, v)

    await db.flush()

    for rc in raw_cards:
        cd = transform_card(rc)
        card_id = cd["id"]
        result = await db.execute(sa.select(Card).where(Card.id == card_id))
        existing = result.scalar_one_or_none()
        if not existing:
            card = Card(**cd)
            db.add(card)
            cards_inserted += 1
        else:
            for k, v in cd.items():
                if k != "id" and hasattr(existing, k):
                    setattr(existing, k, v)
            cards_updated += 1

    await db.commit()

    # Count total cards in DB
    total_result = await db.execute(sa.select(sa.func.count()).select_from(Card))
    total_cards = total_result.scalar() or 0

    return {
        "factions_inserted": factions_inserted,
        "cards_inserted": cards_inserted,
        "cards_updated": cards_updated,
        "total_cards": total_cards,
    }


if __name__ == "__main__":
    json_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not json_path:
        print("❌ Usage: python seed_cards.py <path_to_card-data.json>")
        sys.exit(1)

    result = asyncio.run(seed(json_path=json_path))
    print(f"✅ Factions: {result.get('factions_inserted', 0)} new "
          f"| Cards: {result.get('cards_inserted', 0)} new, "
          f"{result.get('cards_updated', 0)} updated "
          f"| Total in DB: {result.get('total_cards', 0)}")
