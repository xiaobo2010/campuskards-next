"""Leaderboard Redis cache."""
from __future__ import annotations

LEADERBOARD_CACHE_KEY = "cache:leaderboard:top100"
LEADERBOARD_CACHE_TTL = 120


async def invalidate_leaderboard_cache() -> None:
    from app.core.cache import cache_delete

    await cache_delete(LEADERBOARD_CACHE_KEY)
