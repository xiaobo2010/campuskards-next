"""Redis cache client with graceful fallback, locks, and helpers."""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client: Optional[redis.Redis] = None
_pubsub_client: Optional[redis.Redis] = None

_RELEASE_LOCK_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
"""


async def get_redis() -> Optional[redis.Redis]:
    """Shared Redis connection for commands (GET/SET/PUBLISH)."""
    global _redis_client
    try:
        if _redis_client is None:
            _redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_keepalive=True,
                health_check_interval=30,
            )
            await _redis_client.ping()
            logger.info("Redis connected")
        return _redis_client
    except Exception as e:
        logger.warning("Redis not available: %s", e)
        return None


async def get_redis_pubsub() -> Optional[redis.Redis]:
    """Dedicated connection for Pub/Sub (do not share with command pool)."""
    global _pubsub_client
    try:
        if _pubsub_client is None:
            _pubsub_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
            )
            await _pubsub_client.ping()
            logger.info("Redis pubsub connected")
        return _pubsub_client
    except Exception as e:
        logger.warning("Redis pubsub not available: %s", e)
        return None


async def close_redis() -> None:
    global _redis_client, _pubsub_client
    for name, client in (("main", _redis_client), ("pubsub", _pubsub_client)):
        if client:
            try:
                await client.aclose()
            except Exception as e:
                logger.warning("Error closing Redis %s: %s", name, e)
    _redis_client = None
    _pubsub_client = None


async def redis_available() -> bool:
    client = await get_redis()
    if not client:
        return False
    try:
        return bool(await client.ping())
    except Exception:
        return False


async def cache_get(key: str) -> Optional[str]:
    try:
        client = await get_redis()
        if client:
            return await client.get(key)
    except Exception as e:
        logger.warning("Cache get error for %s: %s", key, e)
    return None


async def cache_mget(keys: list[str]) -> list[Optional[str]]:
    if not keys:
        return []
    try:
        client = await get_redis()
        if client:
            return await client.mget(keys)
    except Exception as e:
        logger.warning("Cache mget error: %s", e)
    return [None] * len(keys)


async def cache_set(key: str, value: str, ttl: int = 3600) -> bool:
    try:
        client = await get_redis()
        if client:
            await client.setex(key, ttl, value)
            return True
    except Exception as e:
        logger.warning("Cache set error for %s: %s", key, e)
    return False


async def cache_set_nx(key: str, value: str, ttl: int = 3600) -> bool:
    try:
        client = await get_redis()
        if client:
            return bool(await client.set(key, value, nx=True, ex=ttl))
    except Exception as e:
        logger.warning("Cache setnx error for %s: %s", key, e)
    return False


async def cache_delete(*keys: str) -> bool:
    if not keys:
        return False
    try:
        client = await get_redis()
        if client:
            await client.delete(*keys)
            return True
    except Exception as e:
        logger.warning("Cache delete error: %s", e)
    return False


async def cache_hset(key: str, field: str, value: str, ttl: int | None = None) -> bool:
    try:
        client = await get_redis()
        if client:
            await client.hset(key, field, value)
            if ttl is not None:
                await client.expire(key, ttl)
            return True
    except Exception as e:
        logger.warning("Cache hset error for %s: %s", key, e)
    return False


async def cache_hdel(key: str, field: str) -> bool:
    try:
        client = await get_redis()
        if client:
            await client.hdel(key, field)
            return True
    except Exception as e:
        logger.warning("Cache hdel error for %s: %s", key, e)
    return False


async def cache_get_json(key: str) -> Any | None:
    raw = await cache_get(key)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def cache_set_json(key: str, value: Any, ttl: int = 3600) -> bool:
    try:
        return await cache_set(key, json.dumps(value), ttl=ttl)
    except (TypeError, ValueError) as e:
        logger.warning("Cache set_json error for %s: %s", key, e)
        return False


async def cache_scan_keys(pattern: str, count: int = 100) -> list[str]:
    keys: list[str] = []
    try:
        client = await get_redis()
        if not client:
            return keys
        async for key in client.scan_iter(match=pattern, count=count):
            keys.append(key)
    except Exception as e:
        logger.warning("Cache scan error for %s: %s", pattern, e)
    return keys


@asynccontextmanager
async def distributed_lock(
    key: str,
    *,
    ttl_sec: float = 5.0,
    wait_sec: float = 3.0,
    poll_sec: float = 0.05,
) -> AsyncIterator[bool]:
    """Redis SET NX lock. Yields True when acquired; False if Redis down (single-worker fallback)."""
    client = await get_redis()
    if not client:
        yield True
        return

    token = uuid.uuid4().hex
    deadline = time.monotonic() + wait_sec
    acquired = False
    try:
        while time.monotonic() < deadline:
            ok = await client.set(key, token, nx=True, ex=max(1, int(ttl_sec)))
            if ok:
                acquired = True
                break
            await asyncio.sleep(poll_sec)
        yield acquired
    finally:
        if acquired:
            try:
                await client.eval(_RELEASE_LOCK_LUA, 1, key, token)
            except Exception as e:
                logger.warning("Lock release failed for %s: %s", key, e)
