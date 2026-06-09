"""System bot user + default deck for PVE practice matches."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Card, Deck, DeckCard, User

# Fixed system identities — stable across restarts / workers
BOT_USER_ID = uuid.UUID("00000000-0000-4000-a000-000000000001")
BOT_DECK_ID = uuid.UUID("00000000-0000-4000-a000-000000000002")
BOT_USERNAME = "训练AI"
BOT_EMAIL = "bot@campuskards.system"
BOT_DECK_NAME = "AI训练卡组"
BOT_FACTION = "key_class"
BOT_DECK_SIZE = 30


def is_bot_user(user_id: str) -> bool:
    try:
        return uuid.UUID(str(user_id)) == BOT_USER_ID
    except ValueError:
        return str(user_id) == str(BOT_USER_ID)


async def ensure_pve_bot(db: AsyncSession) -> tuple[User, Deck]:
    """Ensure the system bot account and a playable 30-card deck exist."""
    user = await db.get(User, BOT_USER_ID)
    if not user:
        user = User(
            id=BOT_USER_ID,
            username=BOT_USERNAME,
            email=BOT_EMAIL,
            password_hash=hash_password(uuid.uuid4().hex),
            elo=1000,
            ink=0,
            role="player",
            is_active=True,
        )
        db.add(user)

    deck = await db.get(Deck, BOT_DECK_ID)
    if not deck:
        deck = Deck(
            id=BOT_DECK_ID,
            user_id=BOT_USER_ID,
            name=BOT_DECK_NAME,
            faction_code=BOT_FACTION,
            is_default=True,
        )
        db.add(deck)
        await db.flush()

    count_stmt = select(DeckCard).where(DeckCard.deck_id == BOT_DECK_ID)
    existing = (await db.execute(count_stmt)).scalars().all()
    card_total = sum(e.quantity for e in existing)
    if card_total < BOT_DECK_SIZE:
        if existing:
            for row in existing:
                await db.delete(row)
            await db.flush()

        cards_result = await db.execute(
            select(Card)
            .where(Card.is_token.is_(False))
            .order_by(Card.cost, Card.name)
            .limit(BOT_DECK_SIZE)
        )
        cards = list(cards_result.scalars().all())
        if len(cards) < BOT_DECK_SIZE:
            raise RuntimeError(
                f"PVE bot deck needs {BOT_DECK_SIZE} cards in DB, found {len(cards)}"
            )
        for card in cards:
            db.add(DeckCard(deck_id=BOT_DECK_ID, card_id=card.id, quantity=1))

    await db.commit()
    await db.refresh(user)
    await db.refresh(deck)
    return user, deck
