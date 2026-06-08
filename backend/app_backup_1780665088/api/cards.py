from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Card
from app.schemas.card import CardOut

router = APIRouter(prefix="/api/cards", tags=["cards"])


@router.get("", response_model=list[CardOut])
async def list_cards(
    faction: str | None = Query(default=None),
    card_type: str | None = Query(default=None),
    cost: int | None = Query(default=None),
    rarity: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[CardOut]:
    stmt = select(Card)
    if faction:
        stmt = stmt.where(Card.faction_code == faction)
    if card_type:
        stmt = stmt.where(Card.card_type == card_type)
    if cost is not None:
        stmt = stmt.where(Card.cost == cost)
    if rarity:
        stmt = stmt.where(Card.rarity == rarity)
    stmt = stmt.order_by(Card.cost, Card.name)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    cards = result.scalars().all()
    return [CardOut.model_validate(c) for c in cards]


@router.get("/{card_id}", response_model=CardOut)
async def get_card(card_id: str, db: AsyncSession = Depends(get_db)) -> CardOut:
    stmt = select(Card).where(Card.id == card_id)
    result = await db.execute(stmt)
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="卡牌不存在")
    return CardOut.model_validate(card)
