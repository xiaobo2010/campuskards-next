import random
import secrets
import time
from dataclasses import dataclass, field

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Card, User, UserCard
from app.api.auth import _get_current_user
from app.schemas.shop import (
    OpenPackRequest,
    OpenPackResponse,
    PackCardItem,
    PackOut,
    SelectorFinalizeRequest,
    SelectorRerollRequest,
)

router = APIRouter(prefix="/api/shop", tags=["shop"])

RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"]
FRAGMENT_VALUES = {"common": 1, "uncommon": 2, "rare": 4, "epic": 8, "legendary": 8}
SELECTOR_SESSION_TTL_SEC = 30 * 60


@dataclass
class SelectorSession:
    user_id: str
    card_ids: list[str]
    created_at: float = field(default_factory=time.time)
    rerolled: bool = False


# Pending selector opens — cards granted on finalize / reroll only
_selector_sessions: dict[str, SelectorSession] = {}


def _purge_expired_selector_sessions() -> None:
    now = time.time()
    expired = [k for k, s in _selector_sessions.items() if now - s.created_at > SELECTOR_SESSION_TTL_SEC]
    for k in expired:
        del _selector_sessions[k]


def _get_selector_session(token: str, user: User) -> SelectorSession:
    _purge_expired_selector_sessions()
    session = _selector_sessions.get(token)
    if not session:
        raise HTTPException(status_code=404, detail="选卡会话已过期或不存在")
    if session.user_id != str(user.id):
        raise HTTPException(status_code=403, detail="无权操作此选卡会话")
    return session


@dataclass
class RarityRoll:
    rarity: str
    prob: float
    max_count: int


@dataclass
class PackDef:
    id: str
    name: str
    description: str
    price_ink: int
    cards_count: int
    cost_type: str = "ink"  # ink | elo
    price_elo: int = 0
    min_elo: int = 0
    rolls: list[RarityRoll] | None = None
    guaranteed_epic: int = 0
    guaranteed_faction: int = 0
    min_rarity: str | None = None
    prestige_epic_prob: float = 0.0
    prestige_legendary_prob: float = 0.0


PACKS: dict[str, PackDef] = {
    "basic": PackDef(
        id="basic",
        name="基础卡包",
        description="5张卡牌，30%概率出稀有(≤2)，3%概率出史诗(≤1)，1%概率出传奇(≤1)",
        price_ink=200,
        cards_count=5,
        rolls=[
            RarityRoll("rare", 0.30, 2),
            RarityRoll("epic", 0.03, 1),
            RarityRoll("legendary", 0.01, 1),
        ],
    ),
    "advanced": PackDef(
        id="advanced",
        name="进阶卡包",
        description="6张卡牌，50%概率出稀有(≤4)，10%概率出史诗(≤2)，3%概率出传奇(≤1)",
        price_ink=600,
        cards_count=6,
        rolls=[
            RarityRoll("rare", 0.50, 4),
            RarityRoll("epic", 0.10, 2),
            RarityRoll("legendary", 0.03, 1),
        ],
    ),
    "selector": PackDef(
        id="selector",
        name="选卡卡包",
        description="8张卡牌，必出1张史诗。开包后可选择1张重抽，或放弃保留原结果",
        price_ink=1000,
        cards_count=8,
        guaranteed_epic=1,
        rolls=[
            RarityRoll("rare", 0.60, 6),
            RarityRoll("epic", 0.15, 3),
            RarityRoll("legendary", 0.05, 1),
        ],
    ),
    "faction": PackDef(
        id="faction",
        name="势力卡包",
        description="5张卡牌，必出2张同势力，其余同进阶卡包概率",
        price_ink=800,
        cards_count=5,
        guaranteed_faction=2,
        rolls=[
            RarityRoll("rare", 0.50, 4),
            RarityRoll("epic", 0.10, 2),
            RarityRoll("legendary", 0.03, 1),
        ],
    ),
    "prestige": PackDef(
        id="prestige",
        name="声望卡包",
        description="3张卡牌，保证稀有以上，40%概率出史诗，10%概率出传奇。需ELO≥2000",
        price_ink=0,
        price_elo=500,
        cost_type="elo",
        min_elo=2000,
        cards_count=3,
        min_rarity="rare",
        prestige_epic_prob=0.40,
        prestige_legendary_prob=0.10,
    ),
}


class BuyPackRequest(BaseModel):
    quantity: int = Field(default=1, ge=1, le=10)


class BuyPackResponse(BaseModel):
    pack_id: str
    quantity: int
    total_cost: int
    remaining_ink: int
    remaining_elo: int | None = None


class OpenPackBody(BaseModel):
    quantity: int = Field(default=1, ge=1, le=10)
    faction_code: str | None = None


def _rarity_index(rarity: str) -> int:
    return RARITY_ORDER.index(rarity) if rarity in RARITY_ORDER else 0


def _pick_card(pool: list[Card], target: str) -> Card:
    idx = _rarity_index(target)
    for tier in range(idx, -1, -1):
        tier_name = RARITY_ORDER[tier]
        candidates = [c for c in pool if (c.rarity or "common") == tier_name]
        if candidates:
            return random.choice(candidates)
    return random.choice(pool)


def _roll_rarity(rolls: list[RarityRoll], counts: dict[str, int]) -> str:
    rarity = "common"
    for roll in rolls:
        if counts.get(roll.rarity, 0) >= roll.max_count:
            continue
        if random.random() < roll.prob:
            if _rarity_index(roll.rarity) > _rarity_index(rarity):
                rarity = roll.rarity
            counts[roll.rarity] = counts.get(roll.rarity, 0) + 1
    return rarity


def _draw_prestige(pool: list[Card]) -> str:
    roll = random.random()
    if roll < 0.10:
        return "legendary"
    if roll < 0.50:
        return "epic"
    return "rare"


def _draw_pack_cards(pack: PackDef, all_cards: list[Card], faction_code: str | None) -> list[Card]:
    pool = [c for c in all_cards if not c.is_token]
    if not pool:
        raise HTTPException(status_code=500, detail="卡牌数据库为空")

    drawn: list[Card] = []
    counts: dict[str, int] = {}

    if pack.guaranteed_faction:
        if not faction_code:
            raise HTTPException(status_code=400, detail="阵营包需要指定 faction_code")
        faction_pool = [c for c in pool if c.faction_code == faction_code]
        if len(faction_pool) < pack.guaranteed_faction:
            raise HTTPException(status_code=400, detail="指定阵营可用卡牌不足")
        for _ in range(pack.guaranteed_faction):
            drawn.append(random.choice(faction_pool))

    remaining = pack.cards_count - len(drawn)

    if pack.id == "prestige":
        for _ in range(remaining):
            rarity = _draw_prestige(pool)
            drawn.append(_pick_card(pool, rarity))
        random.shuffle(drawn)
        return drawn

    if pack.guaranteed_epic:
        counts["epic"] = counts.get("epic", 0) + 1
        drawn.append(_pick_card(pool, "epic"))
        remaining = pack.cards_count - len(drawn)

    rolls = pack.rolls or []
    for _ in range(remaining):
        rarity = _roll_rarity(rolls, counts)
        drawn.append(_pick_card(pool, rarity))

    random.shuffle(drawn)
    return drawn


def _draw_selector_reroll_card(pack: PackDef, all_cards: list[Card]) -> Card:
    """Single-card redraw for selector pack (no guaranteed epic on reroll)."""
    pool = [c for c in all_cards if not c.is_token]
    if not pool:
        raise HTTPException(status_code=500, detail="卡牌数据库为空")
    counts: dict[str, int] = {}
    rolls = pack.rolls or []
    rarity = _roll_rarity(rolls, counts)
    return _pick_card(pool, rarity)


async def _build_pack_response(
    *,
    pack_id: str,
    drawn_cards: list[Card],
    user: User,
    db: AsyncSession,
    existing_before: set[str],
    can_reroll: bool = False,
    reroll_token: str | None = None,
) -> OpenPackResponse:
    """Build open-pack response; optionally apply cards to collection."""
    if can_reroll:
        # Deferred grant — preview only
        drawn_items = [
            PackCardItem(
                card_id=card.id,
                name=card.name,
                rarity=card.rarity or "common",
                faction_code=card.faction_code,
                is_new=card.id not in existing_before,
                slot_index=i,
            )
            for i, card in enumerate(drawn_cards)
        ]
        return OpenPackResponse(
            pack_id=pack_id,
            cards=drawn_items,
            new=[c.card_id for c in drawn_items if c.is_new],
            fragments={},
            remaining_ink=user.ink,
            remaining_elo=user.elo,
            can_reroll=True,
            reroll_token=reroll_token,
        )

    uc_result = await db.execute(select(UserCard).where(UserCard.user_id == user.id))
    existing_map: dict[str, UserCard] = {uc.card_id: uc for uc in uc_result.scalars().all()}

    drawn_items: list[PackCardItem] = []
    new_ids: list[str] = []
    fragment_drops: dict[str, int] = {}

    for i, card in enumerate(drawn_cards):
        rarity = card.rarity or "common"
        frag_value = FRAGMENT_VALUES.get(rarity, 1)

        if card.id in existing_map:
            existing_map[card.id].fragments = (existing_map[card.id].fragments or 0) + frag_value
            fragment_drops[rarity] = fragment_drops.get(rarity, 0) + frag_value
            is_new = False
        else:
            uc = UserCard(user_id=user.id, card_id=card.id, count=1, level=1, fragments=0)
            db.add(uc)
            existing_map[card.id] = uc
            is_new = True
            new_ids.append(card.id)

        drawn_items.append(
            PackCardItem(
                card_id=card.id,
                name=card.name,
                rarity=rarity,
                faction_code=card.faction_code,
                is_new=is_new,
                slot_index=i,
            )
        )

    await db.commit()
    await db.refresh(user)

    return OpenPackResponse(
        pack_id=pack_id,
        cards=drawn_items,
        new=new_ids,
        fragments=fragment_drops,
        remaining_ink=user.ink,
        remaining_elo=user.elo,
    )


async def _finalize_selector_session(
    session: SelectorSession,
    user: User,
    db: AsyncSession,
    all_cards: list[Card],
) -> OpenPackResponse:
    card_map = {c.id: c for c in all_cards}
    drawn_cards = [card_map[cid] for cid in session.card_ids if cid in card_map]
    if len(drawn_cards) != len(session.card_ids):
        raise HTTPException(status_code=500, detail="选卡会话数据异常")

    uc_result = await db.execute(select(UserCard).where(UserCard.user_id == user.id))
    existing_before = {uc.card_id for uc in uc_result.scalars().all()}

    return await _build_pack_response(
        pack_id="selector",
        drawn_cards=drawn_cards,
        user=user,
        db=db,
        existing_before=existing_before,
    )


def _pack_cost(pack: PackDef, quantity: int) -> tuple[int, int]:
    if pack.cost_type == "elo":
        return 0, pack.price_elo * quantity
    return pack.price_ink * quantity, 0


@router.get("/packs", response_model=list[PackOut])
async def list_packs(_user: User = Depends(_get_current_user)) -> list[PackOut]:
    return [
        PackOut(
            id=p.id,
            name=p.name,
            description=p.description,
            price_ink=p.price_ink,
            cards_count=p.cards_count,
            cost_type=p.cost_type,
            price_elo=p.price_elo,
            min_elo=p.min_elo,
        )
        for p in PACKS.values()
    ]


@router.post("/packs/{pack_id}/buy", response_model=BuyPackResponse)
async def buy_pack(
    pack_id: str,
    body: BuyPackRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BuyPackResponse:
    pack = PACKS.get(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="卡包不存在")

    ink_cost, elo_cost = _pack_cost(pack, body.quantity)

    if pack.cost_type == "elo":
        if user.elo < pack.min_elo:
            raise HTTPException(status_code=400, detail=f"需要 ELO ≥ {pack.min_elo}")
        if user.elo < elo_cost:
            raise HTTPException(status_code=400, detail="ELO 不足")
        user.elo -= elo_cost
    else:
        if user.ink < ink_cost:
            raise HTTPException(status_code=400, detail="墨水不足")
        user.ink -= ink_cost

    await db.commit()
    await db.refresh(user)

    return BuyPackResponse(
        pack_id=pack_id,
        quantity=body.quantity,
        total_cost=elo_cost if pack.cost_type == "elo" else ink_cost,
        remaining_ink=user.ink,
        remaining_elo=user.elo if pack.cost_type == "elo" else None,
    )


@router.post("/packs/{pack_id}/open", response_model=OpenPackResponse)
async def open_pack_by_id(
    pack_id: str,
    body: OpenPackBody,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OpenPackResponse:
    pack = PACKS.get(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="卡包不存在")

    ink_cost, elo_cost = _pack_cost(pack, body.quantity)

    if pack.cost_type == "elo":
        if user.elo < pack.min_elo:
            raise HTTPException(status_code=400, detail=f"需要 ELO ≥ {pack.min_elo}")
        if user.elo < elo_cost:
            raise HTTPException(status_code=400, detail="ELO 不足")
        user.elo -= elo_cost
    else:
        if user.ink < ink_cost:
            raise HTTPException(status_code=400, detail="墨水不足")
        user.ink -= ink_cost

    result = await db.execute(select(Card))
    all_cards = list(result.scalars().all())

    drawn_cards: list[Card] = []
    for _ in range(body.quantity):
        drawn_cards.extend(_draw_pack_cards(pack, all_cards, body.faction_code))

    uc_result = await db.execute(select(UserCard).where(UserCard.user_id == user.id))
    existing_before = {uc.card_id for uc in uc_result.scalars().all()}

    # Selector pack: defer collection grant until finalize / reroll
    if pack_id == "selector" and body.quantity == 1:
        token = secrets.token_urlsafe(32)
        _selector_sessions[token] = SelectorSession(
            user_id=str(user.id),
            card_ids=[c.id for c in drawn_cards],
        )
        await db.commit()
        await db.refresh(user)
        return await _build_pack_response(
            pack_id=pack_id,
            drawn_cards=drawn_cards,
            user=user,
            db=db,
            existing_before=existing_before,
            can_reroll=True,
            reroll_token=token,
        )

    return await _build_pack_response(
        pack_id=pack_id,
        drawn_cards=drawn_cards,
        user=user,
        db=db,
        existing_before=existing_before,
    )


@router.post("/packs/selector/finalize", response_model=OpenPackResponse)
async def finalize_selector_pack(
    body: SelectorFinalizeRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OpenPackResponse:
    """Keep all cards from a selector open (skip reroll)."""
    session = _get_selector_session(body.reroll_token, user)

    result = await db.execute(select(Card))
    all_cards = list(result.scalars().all())
    response = await _finalize_selector_session(session, user, db, all_cards)
    del _selector_sessions[body.reroll_token]
    return response


@router.post("/packs/selector/reroll", response_model=OpenPackResponse)
async def reroll_selector_card(
    body: SelectorRerollRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OpenPackResponse:
    """Replace one card slot in a selector open, then grant all cards."""
    session = _get_selector_session(body.reroll_token, user)
    if session.rerolled:
        raise HTTPException(status_code=400, detail="重抽机会已使用")
    if body.slot_index >= len(session.card_ids):
        raise HTTPException(status_code=400, detail="无效的卡牌位置")

    result = await db.execute(select(Card))
    all_cards = list(result.scalars().all())
    pack = PACKS["selector"]

    new_card = _draw_selector_reroll_card(pack, all_cards)
    session.card_ids[body.slot_index] = new_card.id
    session.rerolled = True

    response = await _finalize_selector_session(session, user, db, all_cards)
    del _selector_sessions[body.reroll_token]
    return response


# Legacy alias — kept for backward compatibility
@router.post("/open-pack", response_model=OpenPackResponse)
async def open_pack_legacy(
    body: OpenPackRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OpenPackResponse:
    pack_id = "advanced" if body.pack_type == "premium" else body.pack_type
    return await open_pack_by_id(
        pack_id,
        OpenPackBody(quantity=1, faction_code=body.faction_code),
        user,
        db,
    )
