import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.auth import _get_current_user
from app.models import User, Match

router = APIRouter(prefix="/api/user", tags=["user"])

UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "avatars"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 2 * 1024 * 1024  # 2MB

EXT_MAP = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


@router.put("/avatar")
async def upload_avatar(
    avatar: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_get_current_user),
):
    if avatar.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "仅支持 JPG/PNG/WebP 格式")

    content = await avatar.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "文件大小不能超过 2MB")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    ext = EXT_MAP.get(avatar.content_type, "jpg")
    filename = f"{user.id}.{ext}"
    filepath = UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        f.write(content)

    avatar_url = f"/uploads/avatars/{filename}"
    user.avatar_url = avatar_url
    await db.commit()

    return {"avatar_url": avatar_url}


@router.get("/profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_get_current_user),
):
    wins = (
        await db.execute(
            select(func.count()).select_from(Match).where(Match.winner_id == user.id)
        )
    ).scalar() or 0
    losses = (
        await db.execute(
            select(func.count())
            .select_from(Match)
            .where(
                ((Match.p1_id == user.id) | (Match.p2_id == user.id))
                & (Match.winner_id.isnot(None))
                & (Match.winner_id != user.id)
            )
        )
    ).scalar() or 0
    total = wins + losses
    win_rate = round(wins / total * 100, 1) if total > 0 else 0.0

    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "elo": user.elo,
        "ink": user.ink,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "stats": {
            "total_wins": wins,
            "total_losses": losses,
            "total_draws": 0,
            "win_rate": win_rate,
        },
    }
