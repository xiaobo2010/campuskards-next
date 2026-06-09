import logging
import time

from fastapi import HTTPException, Request

from app.core.cache import get_redis

logger = logging.getLogger(__name__)


async def check_rate_limit(
    key: str,
    max_requests: int,
    window_sec: int,
) -> bool:
    client = await get_redis()
    if not client:
        return True
    try:
        now = int(time.time())
        window_key = f"ratelimit:{key}:{now // window_sec}"
        count = await client.incr(window_key)
        if count == 1:
            await client.expire(window_key, window_sec + 1)
        return count <= max_requests
    except Exception as e:
        logger.warning("Rate limit check failed for %s: %s", key, e)
        return True


def rate_limit(max_requests: int, window_sec: int, key_prefix: str):
    async def endpoint_dependency(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        key = f"{key_prefix}:{ip}"
        ok = await check_rate_limit(key, max_requests, window_sec)
        if not ok:
            raise HTTPException(status_code=429, detail="请求过于频繁，请稍后重试")
    return endpoint_dependency
