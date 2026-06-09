"""WebSocket handler for real-time matches (DEVELOPMENT.md §4.11)."""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.database import async_session
from app.core.game_engine import GameError
from app.core.security import decode_token
from app.services.game_manager import game_manager

logger = logging.getLogger(__name__)
ws_router = APIRouter()


async def _authenticate_ws(token: str | None) -> str | None:
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    return payload.get("sub")


@ws_router.websocket("/ws/game/{match_id}")
async def game_websocket(
    websocket: WebSocket,
    match_id: str,
) -> None:
    # Read token from subprotocol header first, then cookie, then query string
    token = None
    sp = websocket.headers.get("sec-websocket-protocol", "")
    if sp:
        token = sp.split(",")[0].strip()
    if not token:
        token = websocket.cookies.get("campuskards_token")
    if not token:
        # Check query string as fallback (legacy)
        from urllib.parse import parse_qs, urlparse
        qs = websocket.url.query if hasattr(websocket.url, 'query') else ""
        if qs:
            params = parse_qs(qs)
            token = params.get("token", [None])[0]

    user_id = await _authenticate_ws(token)
    if not user_id:
        await websocket.close(code=4401, reason="Unauthorized")
        return

    try:
        room = await game_manager.get_room(match_id)
        if not room:
            await websocket.close(code=4404, reason="Match not found")
            return
        if user_id not in (room.p1_id, room.p2_id):
            await websocket.close(code=4403, reason="Not a participant")
            return

        subprotocol = token if token else None
        await websocket.accept(subprotocol=subprotocol)
        await game_manager.connect(match_id, user_id, websocket)

        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_json(), timeout=120)
            except TimeoutError:
                logger.info("WS %s: receive timeout, closing", match_id)
                break

            event = raw.get("event")
            payload = raw.get("payload") or {}

            try:
                finalize_result = None

                if event == "join_match":
                    await game_manager.handle_join(room, user_id)
                    if room.game.game_over:
                        async with async_session() as db:
                            finalize_result = await game_manager.finalize_if_over(room, db)

                elif event == "play_card":
                    finalize_result = await game_manager.handle_play_card(
                        room,
                        user_id,
                        str(payload.get("card_id", "")),
                        str(payload.get("position", "front")),
                        payload.get("slot"),
                        str(payload.get("target_id")) if payload.get("target_id") else None,
                    )

                elif event == "attack":
                    attacker_ids = payload.get("attacker_ids") or []
                    target_id = payload.get("target_id")
                    finalize_result = await game_manager.handle_attack(
                        room,
                        user_id,
                        [str(a) for a in attacker_ids],
                        str(target_id) if target_id else None,
                    )

                elif event == "end_turn":
                    finalize_result = await game_manager.handle_end_turn(room, user_id)

                elif event == "resolve_choice":
                    finalize_result = await game_manager.handle_resolve_choice(
                        room,
                        user_id,
                        str(payload.get("choice_id", "")),
                        str(payload.get("target_id")) if payload.get("target_id") else None,
                    )

                elif event == "resolve_discard":
                    card_uids = payload.get("card_uids") or []
                    finalize_result = await game_manager.handle_resolve_discard(
                        room,
                        user_id,
                        [str(c) for c in card_uids],
                    )

                elif event == "move_unit":
                    finalize_result = await game_manager.handle_move_unit(
                        room,
                        user_id,
                        str(payload.get("unit_id", "")),
                        str(payload.get("to_line", "front")),
                    )

                elif event == "ping":
                    await websocket.send_json({"event": "pong", "payload": {}})

                elif event == "use_ability":
                    finalize_result = await game_manager.handle_use_ability(
                        room,
                        user_id,
                        str(payload.get("card_id", "")),
                        str(payload.get("target_id")) if payload.get("target_id") else None,
                    )

                else:
                    await websocket.send_json({
                        "event": "error",
                        "payload": {"detail": f"未知事件: {event}"},
                    })

                if finalize_result:
                    break

            except GameError as exc:
                await websocket.send_json({"event": "error", "payload": {"detail": str(exc)}})

    except WebSocketDisconnect:
        logger.info("WS %s: client disconnected", match_id)
    except Exception as exc:
        logger.exception("WS %s: unhandled error: %s", match_id, exc)
    finally:
        await game_manager.disconnect(match_id, user_id, ws=websocket)
