"""Redis-backed persistence for active match rooms."""
from __future__ import annotations

import json
import logging
from typing import Any

from app.core.cache import cache_delete, cache_get, cache_set
from app.core.game_persistence import deserialize_game, serialize_room_meta

logger = logging.getLogger(__name__)

ROOM_KEY_PREFIX = "match:room:"
ROOM_TTL_SECONDS = 7200


def _room_key(match_id: str) -> str:
    return f"{ROOM_KEY_PREFIX}{match_id}"


async def save_room(room: Any) -> bool:
    """Persist room metadata + game state to Redis."""
    try:
        payload = json.dumps(serialize_room_meta(room))
        return await cache_set(_room_key(room.match_id), payload, ttl=ROOM_TTL_SECONDS)
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
    return await cache_delete(_room_key(match_id))


def hydrate_game_from_data(data: dict[str, Any]):
    """Rebuild GameState from stored room blob."""
    return deserialize_game(data["game"])
