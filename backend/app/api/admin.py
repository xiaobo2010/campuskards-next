import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pathlib import Path

from app.core.database import get_db
from app.api.auth import _get_current_user, _require_admin
from app.models import AdminAuditLog, User, Card, Announcement, UserCard
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate, AnnouncementOut
from app.schemas.admin import AdminUserUpdate, CardUpdate, ResetKeyUpdate, PinRequest
from app.schemas.card import CardOut


async def _audit_log(
    db: AsyncSession,
    admin: User,
    action: str,
    target_type: str,
    target_id: str,
    detail: str | None = None,
) -> None:
    log = AdminAuditLog(
        admin_id=admin.id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail,
    )
    db.add(log)
    await db.flush()


router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(_require_admin)],
)


@router.get("/stats")
async def admin_stats(db: AsyncSession = Depends(get_db)) -> dict:
    users_count = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    cards_count = (await db.execute(select(func.count()).select_from(Card))).scalar() or 0
    announcements_count = (
        await db.execute(select(func.count()).select_from(Announcement))
    ).scalar() or 0
    total_ink = (await db.execute(select(func.coalesce(func.sum(User.ink), 0)))).scalar() or 0

    return {
        "users": users_count,
        "cards": cards_count,
        "announcements": announcements_count,
        "total_ink": total_ink,
    }


@router.get("/users")
async def list_admin_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(User)
    if search:
        stmt = stmt.where(
            or_(
                User.username.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
        )
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(User.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    users = result.scalars().all()

    items = [
        {
            "id": str(u.id),
            "username": u.username,
            "email": u.email,
            "elo": u.elo,
            "ink": u.ink,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    body: AdminUserUpdate,
    admin: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # Prevent self-demotion / self-deactivation
    if user.id == admin.id:
        changes = body.model_dump(exclude_unset=True)
        if "role" in changes or "is_active" in changes:
            raise HTTPException(status_code=403, detail="不能修改自己的角色或激活状态")

    before = {k: str(getattr(user, k, "")) for k in body.model_dump(exclude_unset=True)}
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    after = {k: str(getattr(user, k, "")) for k in update_data}

    await _audit_log(db, admin, "update_user", "user", str(user.id),
                     detail=f"changed {list(update_data.keys())}: {before} -> {after}")
    await db.commit()
    await db.refresh(user)
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "elo": user.elo,
        "ink": user.ink,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/cards")
async def list_admin_cards(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    faction: str | None = Query(default=None, alias="faction_code"),
    card_type: str | None = Query(default=None),
    rarity: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(Card)
    if faction:
        stmt = stmt.where(Card.faction_code == faction)
    if card_type:
        stmt = stmt.where(Card.card_type == card_type)
    if rarity:
        stmt = stmt.where(Card.rarity == rarity)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(Card.cost, Card.name)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    cards = result.scalars().all()
    return {
        "items": [CardOut.model_validate(c) for c in cards],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/cards/{card_id}", response_model=CardOut)
async def update_card(
    card_id: str,
    body: CardUpdate,
    admin: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> CardOut:
    stmt = select(Card).where(Card.id == card_id)
    result = await db.execute(stmt)
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="卡牌不存在")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(card, field, value)

    await _audit_log(db, admin, "update_card", "card", card_id,
                     detail=f"changed {list(update_data.keys())}")
    await db.commit()
    await db.refresh(card)
    return CardOut.model_validate(card)


@router.get("/announcements")
async def list_admin_announcements(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(Announcement).options(selectinload(Announcement.author))
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = (
        stmt.order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    announcements = result.scalars().all()
    return {
        "items": [AnnouncementOut.model_validate(a) for a in announcements],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/announcements", response_model=AnnouncementOut, status_code=201)
async def create_announcement(
    body: AnnouncementCreate,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnnouncementOut:
    announcement = Announcement(
        title=body.title,
        content=body.content,
        category=body.category,
        priority=body.priority,
        is_pinned=body.is_pinned,
        author_id=user.id,
    )
    db.add(announcement)
    await db.flush()
    await _audit_log(db, user, "create_announcement", "announcement", str(announcement.id),
                     detail=f"title={body.title}")
    await db.commit()
    await db.refresh(announcement)
    return AnnouncementOut.model_validate(announcement)


@router.put("/announcements/{announcement_id}", response_model=AnnouncementOut)
async def update_announcement_put(
    announcement_id: str,
    body: AnnouncementUpdate,
    admin: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> AnnouncementOut:
    return await _update_announcement(announcement_id, body, db, admin=admin)


@router.patch("/announcements/{announcement_id}", response_model=AnnouncementOut)
async def update_announcement_patch(
    announcement_id: str,
    body: AnnouncementUpdate,
    admin: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> AnnouncementOut:
    return await _update_announcement(announcement_id, body, db, admin=admin)


async def _update_announcement(
    announcement_id: str,
    body: AnnouncementUpdate,
    db: AsyncSession,
    admin: User | None = None,
) -> AnnouncementOut:
    stmt = select(Announcement).where(Announcement.id == announcement_id)
    result = await db.execute(stmt)
    announcement = result.scalar_one_or_none()
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(announcement, field, value)

    if admin:
        await _audit_log(db, admin, "update_announcement", "announcement", announcement_id,
                         detail=f"changed {list(update_data.keys())}")
    await db.commit()
    await db.refresh(announcement)
    return AnnouncementOut.model_validate(announcement)


@router.delete("/announcements/{announcement_id}", status_code=204)
async def delete_announcement(
    announcement_id: str,
    admin: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    stmt = select(Announcement).where(Announcement.id == announcement_id)
    result = await db.execute(stmt)
    announcement = result.scalar_one_or_none()
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    await _audit_log(db, admin, "delete_announcement", "announcement", announcement_id,
                     detail=f"title={announcement.title}")
    await db.delete(announcement)
    await db.commit()


@router.patch("/announcements/{announcement_id}/pin", response_model=AnnouncementOut)
async def pin_announcement(
    announcement_id: str,
    body: PinRequest,
    admin: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> AnnouncementOut:
    stmt = select(Announcement).where(Announcement.id == announcement_id)
    result = await db.execute(stmt)
    announcement = result.scalar_one_or_none()
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")

    announcement.is_pinned = body.is_pinned
    await _audit_log(db, admin, "pin_announcement", "announcement", announcement_id,
                     detail=f"is_pinned={body.is_pinned}")
    await db.commit()
    await db.refresh(announcement)
    return AnnouncementOut.model_validate(announcement)


@router.post("/users/{user_id}/reset-key")
async def set_user_reset_key(
    user_id: str,
    body: ResetKeyUpdate,
    admin: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """设置用户的密码重置密钥（仅管理员）。"""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的用户 ID")

    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.reset_key = body.reset_key
    await _audit_log(db, admin, "set_reset_key", "user", str(user.id),
                     detail="reset key was set by admin")
    await db.commit()
    await db.refresh(user)

    return {"message": "重置密钥已更新", "user_id": str(user.id)}


@router.post("/cards/reseed")
async def admin_reseed_cards(
    admin: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Resolve card-data.json relative to backend directory
    # Try several possible locations
    possible_paths = [
        Path("scripts/card-data.json"),
        Path(__file__).resolve().parent.parent.parent / "scripts" / "card-data.json",
        Path("card-data.json"),
    ]
    json_path = None
    for p in possible_paths:
        if p.exists():
            json_path = str(p.resolve())
            break

    if not json_path:
        raise HTTPException(status_code=500, detail="未找到 card-data.json 文件")

    from scripts.seed_cards import seed as seed_cards

    result = await seed_cards(db=db, json_path=json_path)
    await _audit_log(db, admin, "reseed_cards", "cards", "all",
                     detail=f"inserted={result['cards_inserted']} updated={result['cards_updated']}")
    return {
        "message": f"导入完成：新增 {result['factions_inserted']} 个势力，"
                   f"新增 {result['cards_inserted']} 张卡牌，"
                   f"更新 {result['cards_updated']} 张卡牌",
        "total_cards": result["total_cards"],
    }
