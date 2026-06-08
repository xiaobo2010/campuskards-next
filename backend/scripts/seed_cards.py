#!/usr/bin/env python3
"""Seed script: import factions + cards from card-data.json into the database.

Supports upsert: existing records are updated, new ones are created.
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models import Card, Faction

# Field mapping: JSON key -> Card model attribute
CARD_FIELD_MAP = {
    "id": "id",
    "name": "name",
    "faction": "faction_code",
    "type": "card_type",
    "subtype": "unit_type",
    "cost": "cost",
    "attack": "power",
    "defense": "grit",
    "hp": "spirit",
    "ability": "effect_text",
    "rarity": "rarity",
    "flavor": "flavor_text",
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
    # mechanic is too long for ability_name (64 chars)
    # We'll derive ability_name from the passive ability prefix
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
    # Set defaults for required fields missing from JSON
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
    # Set defaults
    code = faction.get("code", "")
    colors = FACTION_COLORS.get(code, ("#6366f1", "#818cf8"))
    # Derive ability_name from passive: take the part before the colon
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


async def seed(json_path: str | None = None) -> int:
    if json_path:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        print("❌ No json_path provided. Usage: python seed_cards.py <path_to_card-data.json>")
        return 0

    factions_inserted = 0
    cards_inserted = 0
    cards_updated = 0

    async with async_session() as db:
        # Seed factions from JSON
        raw_factions = data.get("factions", [])
        # Also ensure 'neutral' faction exists
        raw_factions.append({"id": "neutral", "name": "中立", "passive": "", "style": "无阵营中立卡", "mechanic": ""})

        for rf in raw_factions:
            fd = transform_faction(rf)
            code = fd["code"]
            stmt = select(Faction).where(Faction.code == code)
            result = await db.execute(stmt)
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

        # Seed cards
        raw_cards = data.get("cards", [])
        for rc in raw_cards:
            cd = transform_card(rc)
            card_id = cd["id"]
            stmt = select(Card).where(Card.id == card_id)
            result = await db.execute(stmt)
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

    print(f"✅ Factions: {factions_inserted} new | Cards: {len(raw_cards)} processed, {cards_inserted} new, {cards_updated} updated")
    return cards_inserted


def main():
    json_path = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(seed(json_path))


if __name__ == "__main__":
    main()
