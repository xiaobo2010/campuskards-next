import uuid
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.auth import _get_current_user
from app.models import Deck, DeckCard, Card, User, UserCard
from app.schemas.card import DeckCreate, DeckUpdate, DeckOut, DeckListOut, DeckCardOut, CardOut

router = APIRouter(prefix="/api/decks", tags=["decks"])

MAX_DECK_SIZE = 30
MIN_FACTION_CARDS = 20
MAX_COPIES = 3


async def _load_deck(db: AsyncSession, deck_id: uuid.UUID) -> Deck | None:
    stmt = (
        select(Deck)
        .options(selectinload(Deck.entries).selectinload(DeckCard.card))
        .where(Deck.id == deck_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def _deck_to_out(deck: Deck) -> DeckOut:
    entries = []
    for e in deck.entries:
        card_out = CardOut.model_validate(e.card) if e.card else None
        entries.append(DeckCardOut(card_id=e.card_id, quantity=e.quantity, card=card_out))
    return DeckOut(
        id=str(deck.id),
        user_id=str(deck.user_id),
        name=deck.name,
        faction_code=deck.faction_code,
        ally_faction_code=deck.ally_faction_code,
        is_default=deck.is_default,
        created_at=deck.created_at,
        entries=entries,
    )


async def _validate_deck_entries(
    db: AsyncSession,
    user: User,
    faction_code: str,
    entries: list,
    *,
    strict: bool = False,
) -> tuple[bool, list[str]]:
    errors: list[str] = []
    total = sum(e.quantity for e in entries)

    if strict and total != MAX_DECK_SIZE:
        errors.append(f"卡组必须包含 {MAX_DECK_SIZE} 张卡牌，当前 {total} 张")

    card_ids = [e.card_id for e in entries]
    counts = Counter()
    for e in entries:
        if e.quantity > MAX_COPIES:
            errors.append(f"卡牌 {e.card_id} 超过 {MAX_COPIES} 张上限")
        counts[e.card_id] += e.quantity

    if card_ids:
        cards_result = await db.execute(select(Card).where(Card.id.in_(card_ids)))
        cards_map = {c.id: c for c in cards_result.scalars().all()}
        faction_count = 0
        for e in entries:
            card = cards_map.get(e.card_id)
            if not card:
                errors.append(f"卡牌 {e.card_id} 不存在")
                continue
            if card.faction_code == faction_code:
                faction_count += e.quantity

        if strict and faction_count < MIN_FACTION_CARDS:
            errors.append(f"主势力卡牌至少需要 {MIN_FACTION_CARDS} 张，当前 {faction_count} 张")

        owned_result = await db.execute(
            select(UserCard.card_id).where(
                UserCard.user_id == user.id,
                UserCard.card_id.in_(card_ids),
            )
        )
        owned_ids = {row[0] for row in owned_result.all()}
        for cid in set(card_ids):
            if cid not in owned_ids:
                errors.append(f"卡牌 {cid} 不在收藏中")

    return len(errors) == 0, errors


@router.post("", response_model=DeckOut, status_code=201)
async def create_deck(
    body: DeckCreate,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeckOut:
    if body.cards:
        valid, errors = await _validate_deck_entries(
            db, user, body.faction_code, body.cards, strict=False
        )
        if not valid:
            raise HTTPException(status_code=400, detail="; ".join(errors))

    deck = Deck(
        user_id=user.id,
        name=body.name,
        faction_code=body.faction_code,
        ally_faction_code=body.ally_faction_code,
    )
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
        out.append(
            DeckListOut(
                id=str(d.id),
                name=d.name,
                faction_code=d.faction_code,
                card_count=card_count,
                created_at=d.created_at,
            )
        )
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


@router.get("/{deck_id}/validate")
async def validate_deck(
    deck_id: str,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        uid = uuid.UUID(deck_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的书包ID")
    deck = await _load_deck(db, uid)
    if not deck or deck.user_id != user.id:
        raise HTTPException(status_code=404, detail="书包不存在")

    valid, errors = await _validate_deck_entries(
        db, user, deck.faction_code, deck.entries, strict=True
    )
    return {"valid": valid, "errors": errors}


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
    if body.faction_code is not None:
        deck.faction_code = body.faction_code
    if body.ally_faction_code is not None:
        deck.ally_faction_code = body.ally_faction_code

    if body.cards is not None:
        valid, errors = await _validate_deck_entries(
            db, user, body.faction_code or deck.faction_code, body.cards, strict=False
        )
        if not valid:
            raise HTTPException(status_code=400, detail="; ".join(errors))

        stmt_del = delete(DeckCard).where(DeckCard.deck_id == deck.id)
        await db.execute(stmt_del)
        await db.flush()

        for entry in body.cards:
            c = await db.get(Card, entry.card_id)
            if not c:
                raise HTTPException(status_code=400, detail=f"卡牌 {entry.card_id} 不存在")
            db.add(DeckCard(deck_id=deck.id, card_id=entry.card_id, quantity=entry.quantity))

    await db.commit()
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
