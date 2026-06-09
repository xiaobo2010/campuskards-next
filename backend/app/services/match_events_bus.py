"""Redis Pub/Sub for cross-worker match event delivery."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Awaitable, Callable

from app.core.cache import get_redis

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = "match:broadcast:"
WORKER_ID = uuid.uuid4().hex[:8]

STATE_REFRESH_EVENT = "__state_refresh__"

DeliverFn = Callable[[str, str, dict, str], Awaitable[None]]

_subscriber_task: asyncio.Task | None = None
_deliver: DeliverFn | None = None


async def start_match_events_bus(deliver: DeliverFn) -> None:
    """Subscribe to match broadcast channels; invoke *deliver* for remote events."""
    global _subscriber_task, _deliver
    _deliver = deliver

    client = await get_redis()
    if not client:
        logger.info("Match events bus disabled (Redis unavailable)")
        return

    pubsub = client.pubsub()
    await pubsub.psubscribe(f"{CHANNEL_PREFIX}*")
    _subscriber_task = asyncio.create_task(_listen(pubsub))
    logger.info("Match events bus started (worker=%s)", WORKER_ID)


async def stop_match_events_bus() -> None:
    global _subscriber_task
    if _subscriber_task:
        _subscriber_task.cancel()
        try:
            await _subscriber_task
        except asyncio.CancelledError:
            pass
        _subscriber_task = None


async def _listen(pubsub) -> None:
    try:
        async for message in pubsub.listen():
            if message.get("type") != "pmessage":
                continue
            raw = message.get("data")
            if not raw or not _deliver:
                continue
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            origin = data.get("origin", "")
            if origin == WORKER_ID:
                continue
            match_id = data.get("match_id", "")
            event = data.get("event", "")
            payload = data.get("payload") or {}
            if not match_id or not event:
                continue
            try:
                await _deliver(match_id, event, payload, origin)
            except Exception as exc:
                logger.warning("Match event deliver failed (%s): %s", match_id, exc)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.warning("Match events bus listener stopped: %s", exc)
    finally:
        try:
            await pubsub.unsubscribe()
            await pubsub.aclose()
        except Exception:
            pass


async def publish_match_event(
    match_id: str,
    event: str,
    payload: dict | None = None,
) -> None:
    """Publish an event to all workers (excluding local echo via origin id)."""
    client = await get_redis()
    if not client:
        return
    body = json.dumps({
        "match_id": match_id,
        "event": event,
        "payload": payload or {},
        "origin": WORKER_ID,
    })
    try:
        await client.publish(f"{CHANNEL_PREFIX}{match_id}", body)
    except Exception as exc:
        logger.warning("Failed to publish match event %s/%s: %s", match_id, event, exc)
