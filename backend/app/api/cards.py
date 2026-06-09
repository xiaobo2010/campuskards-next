from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.auth import _get_current_user as get_current_user
from app.models import Card, UserCard, User
from app.schemas.card import CardOut
from app.schemas import PaginatedResponse

router = APIRouter(prefix="/api/cards", tags=["cards"])

# --- Upgrade System Constants ---
# UPGRADE_COSTS[rarity][level] = (fragments_needed, ink_needed)
# level = current level, cost to go from level -> level+1
UPGRADE_COSTS: dict[str, dict[int, tuple[int, int]]] = {
    "common": {
        1: (2, 50), 2: (3, 100), 3: (4, 150), 4: (5, 200),
        5: (6, 300), 6: (8, 400), 7: (10, 500), 8: (12, 650), 9: (15, 800),
    },
    "uncommon": {
        1: (3, 80), 2: (4, 150), 3: (5, 220), 4: (7, 300),
        5: (9, 420), 6: (11, 560), 7: (14, 720), 8: (17, 900), 9: (20, 1100),
    },
    "rare": {
        1: (4, 120), 2: (6, 220), 3: (8, 340), 4: (10, 480),
        5: (13, 650), 6: (16, 840), 7: (20, 1060), 8: (24, 1300), 9: (28, 1600),
    },
    "legendary": {
        1: (6, 200), 2: (8, 360), 3: (11, 540), 4: (14, 750),
        5: (18, 1000), 6: (22, 1280), 7: (27, 1600), 8: (32, 1960), 9: (38, 2400),
    },
}

# Alias: epic uses same costs as legendary
UPGRADE_COSTS["epic"] = UPGRADE_COSTS["legendary"]

MAX_LEVEL = 10

# Stat growth per level-up by unit_type
STAT_GROWTH: dict[str, dict[str, int]] = {
    "INFANTRY": {"power": 1, "grit": 0, "spirit": 1},
    "TANK": {"power": 0, "grit": 1, "spirit": 2},
    "ARTILLERY": {"power": 1, "grit": 0, "spirit": 0},
    "FIGHTER": {"power": 1, "grit": 0, "spirit": 1},
    "BOMBER": {"power": 1, "grit": 0, "spirit": 0},
}

# Default growth for types not in the table
DEFAULT_GROWTH = {"power": 1, "grit": 0, "spirit": 1}


@router.get("", response_model=PaginatedResponse[CardOut])
async def list_cards(
    faction: str | None = Query(default=None, alias="faction_code"),
    card_type: str | None = Query(default=None),
    cost: int | None = Query(default=None),
    rarity: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> PaginatedResponse[CardOut]:
    stmt = select(Card).where(or_(Card.is_token.is_(False), Card.is_token.is_(None)))

    if faction:
        stmt = stmt.where(Card.faction_code == faction)
    if card_type:
        stmt = stmt.where(Card.card_type == card_type)
    if cost is not None:
        stmt = stmt.where(Card.cost == cost)
    if rarity:
        stmt = stmt.where(Card.rarity == rarity)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(Card.cost, Card.name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    cards = result.scalars().all()

    return PaginatedResponse(
        items=[CardOut.model_validate(c) for c in cards],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{card_id}", response_model=CardOut)
async def get_card(
    card_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> CardOut:
    result = await db.execute(select(Card).where(Card.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(404, "Card not found")
    return CardOut.model_validate(card)


@router.get("/{card_id}/owned")
async def check_owned(
    card_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == card_id)
    )
    return {"owned": result.scalar_one_or_none() is not None}


@router.post("/{card_id}/upgrade")
async def upgrade_card(
    card_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """升级卡牌：消耗碎片和墨水，提升等级和属性"""
    # 1. Get UserCard
    uc_result = await db.execute(
        select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == card_id)
    )
    user_card = uc_result.scalar_one_or_none()
    if not user_card:
        raise HTTPException(404, "你还没有这张卡牌")

    # 2. Get Card info
    card_result = await db.execute(select(Card).where(Card.id == card_id))
    card = card_result.scalar_one_or_none()
    if not card:
        raise HTTPException(404, "卡牌不存在")

    current_level = user_card.level or 1
    current_fragments = user_card.fragments or 0

    # Check max level
    if current_level >= MAX_LEVEL:
        raise HTTPException(400, "已满级")

    # 3. Get upgrade cost
    rarity = card.rarity or "common"
    rarity_costs = UPGRADE_COSTS.get(rarity, UPGRADE_COSTS["common"])
    cost = rarity_costs.get(current_level)
    if cost is None:
        raise HTTPException(400, "已满级")

    fragments_needed, ink_needed = cost

    # 4. Check fragments
    if current_fragments < fragments_needed:
        raise HTTPException(
            400,
            f"碎片不足：需要 {fragments_needed}，当前 {current_fragments}"
        )

    # 5. Check ink
    user_result = await db.execute(select(User).where(User.id == user.id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")

    if user.ink < ink_needed:
        raise HTTPException(
            400,
            f"墨水不足：需要 {ink_needed}，当前 {user.ink}"
        )

    # 6. Deduct resources
    user_card.fragments = current_fragments - fragments_needed
    user_card.level = current_level + 1
    user.ink -= ink_needed

    # 7. Calculate new stats
    new_level = user_card.level
    unit_type = (card.unit_type or "").upper()
    growth = STAT_GROWTH.get(unit_type, DEFAULT_GROWTH)

    base_power = card.power or 0
    base_grit = card.grit or 0
    base_spirit = card.spirit or 0

    new_power = base_power + (new_level - 1) * growth["power"]
    new_grit = base_grit + (new_level - 1) * growth["grit"]
    new_spirit = base_spirit + (new_level - 1) * growth["spirit"]

    await db.commit()

    return {
        "card_id": card_id,
        "new_level": new_level,
        "power": new_power,
        "grit": new_grit,
        "spirit": new_spirit,
        "fragments_remaining": user_card.fragments,
        "ink_remaining": user.ink,
    }
