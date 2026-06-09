"""Redis-backed persistence for active match rooms."""
from __future__ import annotations

import json
import logging
from typing import Any

from app.core.cache import cache_delete, cache_get, cache_hdel, cache_hset, cache_set, cache_set_nx
from app.core.game_persistence import deserialize_game, serialize_room_meta
from app.services.match_events_bus import get_worker_id

logger = logging.getLogger(__name__)

ROOM_KEY_PREFIX = "match:room:"
ROOM_TTL_SECONDS = 7200
OWNER_KEY_PREFIX = "match:room:owner:"
PRESENCE_KEY_PREFIX = "match:presence:"
ROOM_LOCK_PREFIX = "match:room:lock:"
TIMER_LOCK_PREFIX = "match:timer:lock:"


def _room_key(match_id: str) -> str:
    return f"{ROOM_KEY_PREFIX}{match_id}"


def _owner_key(match_id: str) -> str:
    return f"{OWNER_KEY_PREFIX}{match_id}"


def _presence_key(match_id: str) -> str:
    return f"{PRESENCE_KEY_PREFIX}{match_id}"


def room_lock_key(match_id: str) -> str:
    return f"{ROOM_LOCK_PREFIX}{match_id}"


def timer_lock_key(match_id: str) -> str:
    return f"{TIMER_LOCK_PREFIX}{match_id}"


async def save_room(room: Any) -> bool:
    """Persist room metadata + game state to Redis; bump version."""
    try:
        current = getattr(room, "_version", 0)
        room._version = current + 1
        payload = json.dumps(serialize_room_meta(room))
        ok = await cache_set(_room_key(room.match_id), payload, ttl=ROOM_TTL_SECONDS)
        if ok:
            await touch_room_keys(room.match_id)
        return ok
    except Exception as exc:
        logger.warning("Failed to save room %s: %s", room.match_id, exc)
        return False


async def load_room_data(match_id: str) -> dict[str, Any] | None:
    """Load serialized room blob from Redis."""
    raw = await cache_get(_room_key(match_id))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Invalid room JSON for match %s", match_id)
        return None


async def delete_room(match_id: str) -> bool:
    await cache_delete(
        _room_key(match_id),
        _owner_key(match_id),
        _presence_key(match_id),
    )
    return True


async def touch_room_keys(match_id: str) -> None:
    """Refresh TTL on room-related keys."""
    from app.core.cache import get_redis

    client = await get_redis()
    if not client:
        return
    for key in (_room_key(match_id), _owner_key(match_id), _presence_key(match_id)):
        try:
            await client.expire(key, ROOM_TTL_SECONDS)
        except Exception:
            pass


async def claim_room_owner(match_id: str) -> bool:
    """Claim match leadership for timers / bot on this worker (first writer wins)."""
    return await cache_set_nx(_owner_key(match_id), get_worker_id(), ttl=ROOM_TTL_SECONDS)


async def get_room_owner(match_id: str) -> str | None:
    return await cache_get(_owner_key(match_id))


async def is_room_owner(match_id: str) -> bool:
    owner = await get_room_owner(match_id)
    return owner == get_worker_id()


async def register_presence(match_id: str, user_id: str) -> None:
    await cache_hset(_presence_key(match_id), user_id, get_worker_id())
    await touch_room_keys(match_id)


async def unregister_presence(match_id: str, user_id: str) -> None:
    await cache_hdel(_presence_key(match_id), user_id)


async def list_presence(match_id: str) -> dict[str, str]:
    from app.core.cache import get_redis

    client = await get_redis()
    if not client:
        return {}
    try:
        raw = await client.hgetall(_presence_key(match_id))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def hydrate_game_from_data(data: dict[str, Any]):
    """Rebuild GameState from stored room blob."""
    return deserialize_game(data["game"])
