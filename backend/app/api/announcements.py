from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.auth import _get_current_user
from app.models import Announcement, User
from app.schemas.announcement import AnnouncementOut
from app.schemas import PaginatedResponse

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


@router.get("", response_model=PaginatedResponse[AnnouncementOut])
async def list_announcements(
    category: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(_get_current_user),
) -> PaginatedResponse[AnnouncementOut]:
    stmt = select(Announcement).options(selectinload(Announcement.author))
    if category:
        stmt = stmt.where(Announcement.category == category)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        stmt.order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    announcements = result.scalars().all()
    return PaginatedResponse(
        items=[AnnouncementOut.model_validate(a) for a in announcements],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{announcement_id}", response_model=AnnouncementOut)
async def get_announcement(
    announcement_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(_get_current_user),
) -> AnnouncementOut:
    stmt = (
        select(Announcement)
        .options(selectinload(Announcement.author))
        .where(Announcement.id == announcement_id)
    )
    result = await db.execute(stmt)
    announcement = result.scalar_one_or_none()
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    return AnnouncementOut.model_validate(announcement)
