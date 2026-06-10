"""Check-in (daily reward) API — /api/checkin"""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import User
from app.api.auth import _get_current_user

router = APIRouter(prefix="/api/checkin", tags=["checkin"])


class CheckinStatusResponse(BaseModel):
    checked_in_today: bool
    streak: int
    total_checkins: int
    next_reward: dict


class CheckinResponse(BaseModel):
    streak: int
    reward: dict
    total_checkins: int


def _ink_reward(streak: int) -> int:
    if streak >= 14:
        return 500
    if streak >= 7:
        return 400
    if streak >= 3:
        return 300
    return 200


def _next_reward(streak: int) -> dict:
    next_streak = streak + 1 if streak > 0 else 1
    return {"day": next_streak, "ink": _ink_reward(next_streak)}


async def _get_streak_info(db: AsyncSession, user_id: uuid.UUID) -> tuple[int, bool, int]:
    today = date.today()
    yesterday = today - timedelta(days=1)

    today_result = await db.execute(
        text("SELECT streak FROM user_checkins WHERE user_id = :uid AND checkin_date = :d"),
        {"uid": user_id, "d": today},
    )
    today_row = today_result.scalar()
    if today_row is not None:
        total = (
            await db.execute(
                text("SELECT COUNT(*) FROM user_checkins WHERE user_id = :uid"),
                {"uid": user_id},
            )
        ).scalar() or 0
        return int(today_row), True, int(total)

    yesterday_result = await db.execute(
        text("SELECT streak FROM user_checkins WHERE user_id = :uid AND checkin_date = :d"),
        {"uid": user_id, "d": yesterday},
    )
    yesterday_streak = int(yesterday_result.scalar() or 0)
    total = (
        await db.execute(
            text("SELECT COUNT(*) FROM user_checkins WHERE user_id = :uid"),
            {"uid": user_id},
        )
    ).scalar() or 0
    return yesterday_streak, False, int(total)


@router.get("/status", response_model=CheckinStatusResponse)
async def checkin_status(
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckinStatusResponse:
    streak, checked_in, total = await _get_streak_info(db, user.id)
    display_streak = streak if checked_in else (streak if streak > 0 else 0)
    return CheckinStatusResponse(
        checked_in_today=checked_in,
        streak=display_streak,
        total_checkins=total,
        next_reward=_next_reward(display_streak if not checked_in else display_streak),
    )


@router.post("", response_model=CheckinResponse)
async def daily_checkin(
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckinResponse:
    today = date.today()
    yesterday = today - timedelta(days=1)

    today_result = await db.execute(
        text("SELECT streak FROM user_checkins WHERE user_id = :uid AND checkin_date = :d"),
        {"uid": user.id, "d": today},
    )
    if today_result.scalar() is not None:
        streak, _, total = await _get_streak_info(db, user.id)
        return CheckinResponse(
            streak=streak,
            reward={"ink": 0},
            total_checkins=total,
        )

    yesterday_result = await db.execute(
        text("SELECT streak FROM user_checkins WHERE user_id = :uid AND checkin_date = :d"),
        {"uid": user.id, "d": yesterday},
    )
    yesterday_streak = int(yesterday_result.scalar() or 0)
    new_streak = yesterday_streak + 1 if yesterday_streak > 0 else 1
    ink_awarded = _ink_reward(new_streak)

    user.ink = (user.ink or 0) + ink_awarded

    await db.execute(
        text(
            "INSERT INTO user_checkins (user_id, checkin_date, streak) "
            "VALUES (:uid, :d, :streak) "
            "ON CONFLICT (user_id, checkin_date) DO NOTHING"
        ),
        {"uid": user.id, "d": today, "streak": new_streak},
    )
    await db.commit()

    total = (
        await db.execute(
            text("SELECT COUNT(*) FROM user_checkins WHERE user_id = :uid"),
            {"uid": user.id},
        )
    ).scalar() or 0

    return CheckinResponse(
        streak=new_streak,
        reward={"ink": ink_awarded},
        total_checkins=int(total),
    )
