from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.auth import _get_current_user
from app.models import User, UserCard, Card
from app.schemas.card import CardOut
from app.schemas.collection import UserCardOut
from app.api.cards import upgrade_card as cards_upgrade_card

router = APIRouter(prefix="/api/collection", tags=["collection"])

FRAGMENT_VALUES = {"common": 1, "uncommon": 2, "rare": 4, "epic": 8, "legendary": 8}


class AddCollectionRequest(BaseModel):
    count: int = 1


class ConvertRequest(BaseModel):
    count: int = 1


@router.get("", response_model=list[UserCardOut])
async def get_collection(
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserCardOut]:
    stmt = (
        select(UserCard)
        .where(UserCard.user_id == user.id)
        .options(selectinload(UserCard.card))
        .order_by(UserCard.card_id)
    )
    result = await db.execute(stmt)
    user_cards = result.scalars().all()
    return [
        UserCardOut(
            card_id=str(uc.card_id),
            count=uc.count,
            level=uc.level or 1,
            fragments=uc.fragments or 0,
            card=CardOut.model_validate(uc.card) if uc.card else None,
        )
        for uc in user_cards
    ]


@router.post("/{card_id}")
async def add_to_collection(
    card_id: str,
    body: AddCollectionRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await db.get(Card, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="卡牌不存在")

    result = await db.execute(
        select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == card_id)
    )
    uc = result.scalar_one_or_none()
    if uc:
        uc.count += body.count
    else:
        db.add(UserCard(user_id=user.id, card_id=card_id, count=body.count, level=1, fragments=0))
    await db.commit()
    return {"card_id": card_id, "added": body.count}


@router.delete("/{card_id}")
async def remove_from_collection(
    card_id: str,
    body: AddCollectionRequest = Body(default=AddCollectionRequest()),
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == card_id)
    )
    uc = result.scalar_one_or_none()
    if not uc:
        raise HTTPException(status_code=404, detail="收藏中无此卡牌")

    if uc.count <= body.count:
        await db.delete(uc)
    else:
        uc.count -= body.count
    await db.commit()
    return {"card_id": card_id, "removed": body.count}


@router.post("/{card_id}/upgrade")
async def upgrade_collection_card(
    card_id: str,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await cards_upgrade_card(card_id, db, user)


@router.post("/{card_id}/convert")
async def convert_to_fragments(
    card_id: str,
    body: ConvertRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.count < 1:
        raise HTTPException(status_code=400, detail="数量必须大于 0")

    card = await db.get(Card, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="卡牌不存在")

    result = await db.execute(
        select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == card_id)
    )
    uc = result.scalar_one_or_none()
    if not uc:
        raise HTTPException(status_code=404, detail="收藏中无此卡牌")
    if uc.count <= body.count:
        raise HTTPException(status_code=400, detail="至少保留 1 张卡牌")

    rarity = card.rarity or "common"
    frag_value = FRAGMENT_VALUES.get(rarity, 1)
    total_fragments = frag_value * body.count

    uc.count -= body.count
    uc.fragments = (uc.fragments or 0) + total_fragments
    await db.commit()

    return {
        "card_id": card_id,
        "converted": body.count,
        "fragments_gained": total_fragments,
        "fragments_total": uc.fragments,
        "count_remaining": uc.count,
    }
