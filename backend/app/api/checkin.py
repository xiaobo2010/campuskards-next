"""Check-in (daily reward) API — /api/checkin"""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import User, UserCheckin
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
    today_date = date.today()
    yesterday = today_date - timedelta(days=1)

    today_stmt = select(UserCheckin).where(
        UserCheckin.user_id == user_id,
        UserCheckin.checkin_date == today_date,
    )
    today_result = await db.execute(today_stmt)
    today_checkin = today_result.scalar_one_or_none()

    total_stmt = select(func.count()).select_from(UserCheckin).where(
        UserCheckin.user_id == user_id,
    )

    if today_checkin is not None:
        total = (await db.execute(total_stmt)).scalar() or 0
        return today_checkin.streak, True, int(total)

    yesterday_stmt = select(UserCheckin).where(
        UserCheckin.user_id == user_id,
        UserCheckin.checkin_date == yesterday,
    )
    yesterday_result = await db.execute(yesterday_stmt)
    yesterday_checkin = yesterday_result.scalar_one_or_none()
    yesterday_streak = yesterday_checkin.streak if yesterday_checkin else 0
    total = (await db.execute(total_stmt)).scalar() or 0
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
    today_date = date.today()
    yesterday = today_date - timedelta(days=1)

    today_stmt = select(UserCheckin).where(
        UserCheckin.user_id == user.id,
        UserCheckin.checkin_date == today_date,
    )
    today_result = await db.execute(today_stmt)
    if today_result.scalar_one_or_none() is not None:
        streak, _, total = await _get_streak_info(db, user.id)
        return CheckinResponse(
            streak=streak,
            reward={"ink": 0},
            total_checkins=total,
        )

    yesterday_stmt = select(UserCheckin).where(
        UserCheckin.user_id == user.id,
        UserCheckin.checkin_date == yesterday,
    )
    yesterday_result = await db.execute(yesterday_stmt)
    yesterday_checkin = yesterday_result.scalar_one_or_none()
    yesterday_streak = yesterday_checkin.streak if yesterday_checkin else 0
    new_streak = yesterday_streak + 1 if yesterday_streak > 0 else 1
    ink_awarded = _ink_reward(new_streak)

    db.add(UserCheckin(user_id=user.id, checkin_date=today_date, streak=new_streak))
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        streak, _, total = await _get_streak_info(db, user.id)
        return CheckinResponse(
            streak=streak,
            reward={"ink": 0},
            total_checkins=total,
        )

    user.ink = (user.ink or 0) + ink_awarded
    await db.commit()

    total_stmt = select(func.count()).select_from(UserCheckin).where(
        UserCheckin.user_id == user.id,
    )
    total = (await db.execute(total_stmt)).scalar() or 0

    return CheckinResponse(
        streak=new_streak,
        reward={"ink": ink_awarded},
        total_checkins=int(total),
    )
