from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get_json, cache_set_json
from app.core.database import get_db
from app.models import User
from app.services.leaderboard_cache import LEADERBOARD_CACHE_KEY, LEADERBOARD_CACHE_TTL

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("")
async def get_leaderboard(
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    cached = await cache_get_json(LEADERBOARD_CACHE_KEY)
    if cached:
        return cached[:limit]

    stmt = (
        select(User.username, User.elo)
        .where(User.is_active == True)  # noqa: E712
        .order_by(User.elo.desc())
        .limit(100)
    )
    result = await db.execute(stmt)
    rows = result.all()
    payload = [
        {"rank": idx + 1, "username": row.username, "elo": row.elo}
        for idx, row in enumerate(rows)
    ]
    await cache_set_json(LEADERBOARD_CACHE_KEY, payload, ttl=LEADERBOARD_CACHE_TTL)
    return payload[:limit]
