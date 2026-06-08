import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.auth import _get_current_user
from app.models import Deck, DeckCard, Card, User
from app.schemas.card import DeckCreate, DeckUpdate, DeckOut, DeckListOut, DeckCardOut, CardOut

router = APIRouter(prefix="/api/decks", tags=["decks"])


async def _load_deck(db: AsyncSession, deck_id: uuid.UUID) -> Deck | None:
    stmt = (
        select(Deck)
        .options(selectinload(Deck.entries).selectinload(DeckCard.card))
        .where(Deck.id == deck_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


@router.post("", response_model=DeckOut, status_code=201)
async def create_deck(
    body: DeckCreate,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeckOut:
    deck = Deck(user_id=user.id, name=body.name, faction_code=body.faction_code)
    db.add(deck)
    await db.flush()

    for entry in body.cards:
        c = await db.get(Card, entry.card_id)
        if not c:
            raise HTTPException(status_code=400, detail=f"卡牌 {entry.card_id} 不存在")
        db.add(DeckCard(deck_id=deck.id, card_id=entry.card_id, quantity=entry.quantity))

    await db.commit()
    deck = await _load_deck(db, deck.id)
    return _deck_to_out(deck)


@router.get("", response_model=list[DeckListOut])
async def list_decks(
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DeckListOut]:
    stmt = (
        select(Deck)
        .options(selectinload(Deck.entries))
        .where(Deck.user_id == user.id)
        .order_by(Deck.created_at.desc())
    )
    result = await db.execute(stmt)
    decks = result.scalars().all()
    out = []
    for d in decks:
        card_count = sum(e.quantity for e in d.entries)
        out.append(DeckListOut(
            id=str(d.id), name=d.name, faction_code=d.faction_code,
            card_count=card_count, created_at=d.created_at,
        ))
    return out


@router.get("/{deck_id}", response_model=DeckOut)
async def get_deck(
    deck_id: str,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeckOut:
    try:
        uid = uuid.UUID(deck_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的书包ID")
    deck = await _load_deck(db, uid)
    if not deck or deck.user_id != user.id:
        raise HTTPException(status_code=404, detail="书包不存在")
    return _deck_to_out(deck)


@router.put("/{deck_id}", response_model=DeckOut)
async def update_deck(
    deck_id: str,
    body: DeckUpdate,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeckOut:
    try:
        uid = uuid.UUID(deck_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的书包ID")
    deck = await _load_deck(db, uid)
    if not deck or deck.user_id != user.id:
        raise HTTPException(status_code=404, detail="书包不存在")

    if body.name is not None:
        deck.name = body.name

    if body.cards is not None:
        # Bulk delete old entries
        stmt_del = delete(DeckCard).where(DeckCard.deck_id == deck.id)
        await db.execute(stmt_del)
        await db.flush()

        for entry in body.cards:
            c = await db.get(Card, entry.card_id)
            if not c:
                raise HTTPException(status_code=400, detail=f"卡牌 {entry.card_id} 不存在")
            db.add(DeckCard(deck_id=deck.id, card_id=entry.card_id, quantity=entry.quantity))

    await db.commit()
    # Fully reload with fresh session state
    db.expire_all()
    deck = await _load_deck(db, uid)
    return _deck_to_out(deck)


@router.delete("/{deck_id}", status_code=204)
async def delete_deck(
    deck_id: str,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        uid = uuid.UUID(deck_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的书包ID")
    stmt = select(Deck).where(Deck.id == uid, Deck.user_id == user.id)
    result = await db.execute(stmt)
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="书包不存在")
    await db.delete(deck)
    await db.commit()


def _deck_to_out(deck: Deck) -> DeckOut:
    entries = []
    for e in deck.entries:
        card_out = CardOut.model_validate(e.card) if e.card else None
        entries.append(DeckCardOut(card_id=e.card_id, quantity=e.quantity, card=card_out))
    return DeckOut(
        id=str(deck.id), user_id=str(deck.user_id), name=deck.name,
        faction_code=deck.faction_code, is_default=deck.is_default,
        created_at=deck.created_at, entries=entries,
    )
