"""Battle victory rewards — ink (normal distribution) and optional pack drops."""
from __future__ import annotations

import random
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.shop import FRAGMENT_VALUES, PACKS, _draw_pack_cards
from app.models import Card, User, UserCard


def roll_ink_reward() -> int:
    """Ink reward for a win: normal(μ=300, σ≈35), clamped to [200, 400]."""
    value = random.gauss(300, 35)
    return max(200, min(400, int(round(value))))


def roll_pack_drops() -> list[str]:
    """10% advanced pack; else 50% basic pack (mutually exclusive rolls)."""
    r = random.random()
    if r < 0.10:
        return ["advanced"]
    if r < 0.60:
        return ["basic"]
    return []


async def _grant_cards(
    user: User,
    db: AsyncSession,
    drawn: list[Card],
) -> list[dict[str, Any]]:
    uc_result = await db.execute(select(UserCard).where(UserCard.user_id == user.id))
    existing_map: dict[str, UserCard] = {uc.card_id: uc for uc in uc_result.scalars().all()}

    granted: list[dict[str, Any]] = []
    for card in drawn:
        rarity = card.rarity or "common"
        frag_value = FRAGMENT_VALUES.get(rarity, 1)
        if card.id in existing_map:
            existing_map[card.id].fragments = (existing_map[card.id].fragments or 0) + frag_value
            is_new = False
        else:
            uc = UserCard(user_id=user.id, card_id=card.id, count=1, level=1, fragments=0)
            db.add(uc)
            existing_map[card.id] = uc
            is_new = True
        granted.append(
            {
                "card_id": card.id,
                "name": card.name,
                "rarity": rarity,
                "faction_code": card.faction_code,
                "is_new": is_new,
            }
        )
    return granted


async def apply_battle_rewards(
    winner: User,
    db: AsyncSession,
    *,
    faction_code: str | None = None,
) -> dict[str, Any]:
    """Grant ink and pack drops to the match winner; return payload for game_over."""
    ink = roll_ink_reward()
    winner.ink = (winner.ink or 0) + ink

    pack_drops: list[dict[str, Any]] = []
    pack_ids = roll_pack_drops()
    if pack_ids:
        all_cards_result = await db.execute(select(Card))
        all_cards = list(all_cards_result.scalars().all())
        for pack_id in pack_ids:
            pack_def = PACKS.get(pack_id)
            if not pack_def:
                continue
            drawn = _draw_pack_cards(pack_def, all_cards, faction_code)
            cards = await _grant_cards(winner, db, drawn)
            pack_drops.append(
                {
                    "pack_id": pack_id,
                    "name": pack_def.name,
                    "cards": cards,
                }
            )

    return {"ink": ink, "packs": pack_drops}
