"""Redis cache client with graceful fallback."""
import redis.asyncio as redis
from typing import Optional, Any
import logging

logger = logging.getLogger(__name__)

_redis_client: Optional[redis.Redis] = None

async def get_redis() -> Optional[redis.Redis]:
    """Get Redis client, return None if not available."""
    global _redis_client
    try:
        if _redis_client is None:
            _redis_client = redis.Redis(
                host="localhost",
                port=6379,
                decode_responses=True,
                socket_connect_timeout=2,
            )
            # Test connection
            await _redis_client.ping()
            logger.info("Redis connected")
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis not available: {e}")
        return None

async def close_redis():
    """Close Redis connection."""
    global _redis_client
    if _redis_client:
        try:
            await _redis_client.close()
        except Exception as e:
            logger.warning(f"Error closing Redis: {e}")
        _redis_client = None

async def cache_get(key: str) -> Optional[str]:
    """Get value from cache, return None if cache unavailable."""
    try:
        client = await get_redis()
        if client:
            return await client.get(key)
    except Exception as e:
        logger.warning(f"Cache get error for {key}: {e}")
    return None

async def cache_set(key: str, value: str, ttl: int = 3600) -> bool:
    """Set value in cache, return False if cache unavailable."""
    try:
        client = await get_redis()
        if client:
            await client.setex(key, ttl, value)
            return True
    except Exception as e:
        logger.warning(f"Cache set error for {key}: {e}")
    return False

async def cache_delete(key: str) -> bool:
    """Delete key from cache, return False if cache unavailable."""
    try:
        client = await get_redis()
        if client:
            await client.delete(key)
            return True
    except Exception as e:
        logger.warning(f"Cache delete error for {key}: {e}")
    return False
