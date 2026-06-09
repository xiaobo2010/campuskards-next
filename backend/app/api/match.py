import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import _get_current_user
from app.api.decks import _load_deck, _validate_deck_entries
from app.core.database import get_db
from app.core.game_engine import GameError
from app.models import Deck, Match, User
from app.schemas.match import (
    EloTimelinePoint,
    MatchDetailResponse,
    MatchHistoryItem,
    MatchQueueCancelResponse,
    MatchQueueRequest,
    MatchQueueResponse,
    MatchQueueStatusResponse,
    MatchStatsResponse,
    MatchSurrenderResponse,
    MatchUserInfo,
    OpponentInfo,
    PveMatchRequest,
    PveMatchResponse,
)
from app.services.game_manager import expand_deck_cards, game_manager
from app.services.matchmaking import ESTIMATED_WAIT_MS, MatchTicket, QueueEntry, matchmaking
from app.services.pve_ai import elo_to_difficulty
from app.services.pve_bot import BOT_DECK_ID, BOT_USER_ID, BOT_USERNAME, ensure_pve_bot

router = APIRouter(prefix="/api/match", tags=["match"])
logger = logging.getLogger(__name__)


def _match_result(match: Match, user_id: uuid.UUID) -> str:
    if match.winner_id is None:
        return "draw"
    if match.winner_id == user_id:
        return "win"
    return "loss"


def _my_elo_change(match: Match, user_id: uuid.UUID) -> int:
    if match.mode != "ranked" or not match.replay_data:
        return 0
    elo_changes = match.replay_data.get("elo_changes") or {}
    slot = "p1" if match.p1_id == user_id else "p2"
    return int(elo_changes.get(slot, 0))


async def _start_match(
    db: AsyncSession,
    ticket,
) -> None:
    p1_deck = await _load_deck(db, uuid.UUID(ticket.p1_deck_id))
    p2_deck = await _load_deck(db, uuid.UUID(ticket.p2_deck_id))
    if not p1_deck or not p2_deck:
        raise HTTPException(status_code=400, detail="卡组不存在")

    p1_cards = await expand_deck_cards(db, p1_deck)
    p2_cards = await expand_deck_cards(db, p2_deck)
    if len(p1_cards) < 30 or len(p2_cards) < 30:
        raise HTTPException(
            status_code=400,
            detail=f"卡组卡牌不足 30 张（P1: {len(p1_cards)}, P2: {len(p2_cards)}）",
        )

    p1_user = await db.get(User, uuid.UUID(ticket.p1_id))
    p2_user = await db.get(User, uuid.UUID(ticket.p2_id))
    p1_hp = 30 + (p1_user.hq_bonus_hp if p1_user else 0)
    p2_hp = 30 + (p2_user.hq_bonus_hp if p2_user else 0)
    from app.core.card_level_stats import elo_bonus_max_ink

    p1_ink = 10 + (elo_bonus_max_ink(p1_user.elo) if p1_user else 0)
    p2_ink = 10 + (elo_bonus_max_ink(p2_user.elo) if p2_user else 0)

    match_row = Match(
        id=uuid.UUID(ticket.match_id),
        p1_id=uuid.UUID(ticket.p1_id),
        p2_id=uuid.UUID(ticket.p2_id),
        p1_deck_id=uuid.UUID(ticket.p1_deck_id),
        p2_deck_id=uuid.UUID(ticket.p2_deck_id),
        mode=ticket.mode,
    )
    db.add(match_row)
    await db.commit()

    bot_difficulty = None
    if str(ticket.p2_id) == str(BOT_USER_ID):
        bot_difficulty = elo_to_difficulty(ticket.p2_elo)
    elif str(ticket.p1_id) == str(BOT_USER_ID):
        bot_difficulty = elo_to_difficulty(ticket.p1_elo)

    room = await game_manager.create_room(
        ticket,
        p1_cards,
        p2_cards,
        p1_starting_hp=p1_hp,
        p2_starting_hp=p2_hp,
        p1_max_ink=p1_ink,
        p2_max_ink=p2_ink,
        bot_difficulty=bot_difficulty,
    )
    room.p1_faction = p1_deck.faction_code
    room.p2_faction = p2_deck.faction_code
    await game_manager._persist_room(room)


@router.post("/queue", response_model=MatchQueueResponse)
async def join_queue(
    body: MatchQueueRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchQueueResponse:
    deck = await _load_deck(db, body.deck_id)
    if not deck or deck.user_id != user.id:
        raise HTTPException(status_code=400, detail="卡组不存在或不属于当前用户")

    ok, errors, _dominant = await _validate_deck_entries(
        db, user, deck.faction_code, deck.entries, strict=True
    )
    if not ok:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    entry = QueueEntry(
        user_id=str(user.id),
        username=user.username,
        elo=user.elo,
        deck_id=str(body.deck_id),
        mode=body.mode,
    )
    try:
        position, ticket = await matchmaking.enqueue(entry)
    except ValueError as exc:
        if str(exc) == "already_queued":
            raise HTTPException(status_code=400, detail="已在匹配队列中") from exc
        if str(exc) == "already_in_match":
            raise HTTPException(status_code=400, detail="已有进行中的对战") from exc
        if str(exc) == "invalid_mode":
            raise HTTPException(status_code=400, detail="无效的匹配模式") from exc
        if str(exc) == "use_pve_endpoint":
            raise HTTPException(status_code=400, detail="PVE 请使用 /api/match/pve") from exc
        raise

    if ticket:
        await _start_match(db, ticket)
        return MatchQueueResponse(
            status="matched",
            mode=body.mode,
            queue_position=0,
            estimated_wait=0,
            match_id=ticket.match_id,
        )

    return MatchQueueResponse(
        status="queued",
        mode=body.mode,
        queue_position=position,
        estimated_wait=ESTIMATED_WAIT_MS,
    )


@router.post("/pve", response_model=PveMatchResponse)
async def start_pve_match(
    body: PveMatchRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PveMatchResponse:
    """Start a single-player practice match against the training AI."""
    status = await matchmaking.get_status(str(user.id))
    if status.get("status") == "matched":
        raise HTTPException(status_code=400, detail="已有进行中的对战")
    if status.get("status") == "queued":
        raise HTTPException(status_code=400, detail="请先取消匹配队列")

    deck = await _load_deck(db, body.deck_id)
    if not deck or deck.user_id != user.id:
        raise HTTPException(status_code=400, detail="卡组不存在或不属于当前用户")

    ok, errors, _dominant = await _validate_deck_entries(
        db, user, deck.faction_code, deck.entries, strict=True
    )
    if not ok:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    try:
        await ensure_pve_bot(db)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI系统初始化失败：{exc}") from exc

    ticket = MatchTicket(
        match_id=str(uuid.uuid4()),
        mode="pve",
        p1_id=str(user.id),
        p1_username=user.username,
        p1_elo=user.elo,
        p1_deck_id=str(body.deck_id),
        p2_id=str(BOT_USER_ID),
        p2_username=BOT_USERNAME,
        p2_elo=user.elo,
        p2_deck_id=str(BOT_DECK_ID),
    )
    try:
        await _start_match(db, ticket)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"创建AI对局失败：{exc}") from exc
    return PveMatchResponse(
        status="matched",
        mode="pve",
        match_id=ticket.match_id,
        opponent=OpponentInfo(id=str(BOT_USER_ID), username=BOT_USERNAME, elo=1000),
    )


@router.delete("/queue", response_model=MatchQueueCancelResponse)
async def leave_queue(
    user: User = Depends(_get_current_user),
    mode: str | None = Query(default=None, pattern="^(quick|ranked)$"),
) -> MatchQueueCancelResponse:
    removed = await matchmaking.dequeue(str(user.id), mode=mode)  # type: ignore[arg-type]
    if not removed:
        # Check if user was just matched — dequeue failed because they're in an active match
        status = await matchmaking.get_status(str(user.id))
        if status.get("status") == "matched":
            match_id = status.get("match_id")
            raise HTTPException(
                status_code=409,
                detail=f"已进入对局 {match_id}，无法取消",
            )
        raise HTTPException(status_code=400, detail="当前不在匹配队列中")
    return MatchQueueCancelResponse()


@router.get("/queue/status", response_model=MatchQueueStatusResponse)
async def queue_status(
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchQueueStatusResponse:
    raw = await matchmaking.get_status(str(user.id))
    if raw["status"] == "matched" and raw.get("match_id"):
        match_id = raw["match_id"]
        room = await game_manager.get_room(match_id)
        opponent: OpponentInfo | None = None
        if room:
            opp_id = room.opponent_id(str(user.id))
            if opp_id:
                opp = await db.get(User, uuid.UUID(opp_id))
                if opp:
                    opponent = OpponentInfo(id=str(opp.id), username=opp.username, elo=opp.elo)
        return MatchQueueStatusResponse(
            status="matched",
            mode=raw.get("mode"),
            match_id=match_id,
            opponent=opponent,
        )

    if raw["status"] == "queued":
        return MatchQueueStatusResponse(
            status="queued",
            mode=raw.get("mode"),
            queue_position=raw.get("queue_position"),
            estimated_wait=raw.get("estimated_wait"),
        )
    return MatchQueueStatusResponse(status="idle")


@router.get("/stats", response_model=MatchStatsResponse)
async def match_stats(
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchStatsResponse:
    uid = user.id
    stmt = select(Match).where(
        or_(Match.p1_id == uid, Match.p2_id == uid),
        Match.ended_at.isnot(None),
    )
    rows = (await db.execute(stmt.order_by(Match.ended_at.asc()))).scalars().all()

    wins = losses = draws = 0
    ranked_matches = quick_matches = 0
    for m in rows:
        res = _match_result(m, uid)
        if res == "win":
            wins += 1
        elif res == "loss":
            losses += 1
        else:
            draws += 1
        if m.mode == "ranked":
            ranked_matches += 1
        else:
            quick_matches += 1

    total = len(rows)
    decided = wins + losses
    win_rate = round(wins / decided, 4) if decided else 0.0

    cutoff = datetime.now(UTC) - timedelta(days=7)
    cumulative = 0
    timeline: list[EloTimelinePoint] = []
    for m in rows:
        if m.mode != "ranked" or not m.ended_at:
            continue
        ended = m.ended_at.replace(tzinfo=UTC) if m.ended_at.tzinfo is None else m.ended_at
        if ended < cutoff:
            continue
        delta = _my_elo_change(m, uid)
        cumulative += delta
        timeline.append(
            EloTimelinePoint(
                match_id=str(m.id),
                ended_at=ended.isoformat(),
                delta=delta,
                cumulative=cumulative,
            )
        )

    return MatchStatsResponse(
        total_matches=total,
        wins=wins,
        losses=losses,
        draws=draws,
        win_rate=win_rate,
        ranked_matches=ranked_matches,
        quick_matches=quick_matches,
        current_elo=user.elo,
        elo_delta_7d=cumulative,
        elo_timeline_7d=timeline,
    )


@router.get("/history")
async def match_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    result: str | None = Query(default=None),
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    uid = user.id
    stmt = select(Match).where(or_(Match.p1_id == uid, Match.p2_id == uid))
    if result in ("win", "loss", "draw"):
        if result == "win":
            stmt = stmt.where(Match.winner_id == uid)
        elif result == "loss":
            stmt = stmt.where(Match.winner_id.isnot(None), Match.winner_id != uid)
        else:
            stmt = stmt.where(Match.winner_id.is_(None), Match.ended_at.isnot(None))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(Match.started_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).scalars().all()

    items: list[MatchHistoryItem] = []
    for m in rows:
        is_p1 = m.p1_id == uid
        opp_id = m.p2_id if is_p1 else m.p1_id
        opp = await db.get(User, opp_id)
        res = _match_result(m, uid)
        my_deck = await db.get(Deck, m.p1_deck_id if is_p1 else m.p2_deck_id)
        opp_deck = await db.get(Deck, m.p2_deck_id if is_p1 else m.p1_deck_id)

        items.append(
            MatchHistoryItem(
                id=str(m.id),
                mode=m.mode or "quick",
                opponent=OpponentInfo(
                    id=str(opp.id) if opp else str(opp_id),
                    username=opp.username if opp else "已注销",
                    elo=opp.elo if opp else 0,
                ),
                result=res,
                my_elo_change=_my_elo_change(m, uid),
                end_reason=m.end_reason,
                my_deck_faction=my_deck.faction_code if my_deck else None,
                opponent_deck_faction=opp_deck.faction_code if opp_deck else None,
                turns_played=m.turns_played,
                started_at=m.started_at.isoformat() if m.started_at else None,
                ended_at=m.ended_at.isoformat() if m.ended_at else None,
            )
        )

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{match_id}", response_model=MatchDetailResponse)
async def get_match(
    match_id: str,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchDetailResponse:
    try:
        mid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的对战 ID")

    match_row = await db.get(Match, mid)
    if not match_row:
        raise HTTPException(status_code=404, detail="对战不存在")
    if user.id not in (match_row.p1_id, match_row.p2_id):
        raise HTTPException(status_code=403, detail="无权查看此对战")

    p1 = await db.get(User, match_row.p1_id)
    p2 = await db.get(User, match_row.p2_id)
    p1_deck = await db.get(Deck, match_row.p1_deck_id)
    p2_deck = await db.get(Deck, match_row.p2_deck_id)
    if not p1 or not p2:
        raise HTTPException(status_code=404, detail="玩家数据缺失")

    status = "finished" if match_row.ended_at else "active"
    replay = match_row.replay_data or await game_manager.get_replay(match_id, db)

    return MatchDetailResponse(
        id=str(match_row.id),
        status=status,
        mode=match_row.mode or "quick",
        end_reason=match_row.end_reason,
        p1=MatchUserInfo(
            id=str(p1.id),
            username=p1.username,
            elo=p1.elo,
            deck_id=str(match_row.p1_deck_id),
            deck_faction=p1_deck.faction_code if p1_deck else None,
        ),
        p2=MatchUserInfo(
            id=str(p2.id),
            username=p2.username,
            elo=p2.elo,
            deck_id=str(match_row.p2_deck_id),
            deck_faction=p2_deck.faction_code if p2_deck else None,
        ),
        winner_id=str(match_row.winner_id) if match_row.winner_id else None,
        turns_played=match_row.turns_played,
        started_at=match_row.started_at.isoformat() if match_row.started_at else None,
        ended_at=match_row.ended_at.isoformat() if match_row.ended_at else None,
        replay_data=replay,
    )


@router.post("/{match_id}/surrender", response_model=MatchSurrenderResponse)
async def surrender_match(
    match_id: str,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchSurrenderResponse:
    room = await game_manager.get_room(match_id)
    if not room:
        raise HTTPException(status_code=404, detail="对战未在进行中或已结束")
    if str(user.id) not in (room.p1_id, room.p2_id):
        raise HTTPException(status_code=403, detail="无权操作此对战")
    if room.game.game_over:
        raise HTTPException(status_code=400, detail="对局已结束")

    try:
        result = await game_manager.handle_surrender(room, str(user.id), db)
    except GameError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Surrender failed for match %s user %s", match_id, user.id)
        raise HTTPException(status_code=500, detail=f"投降处理失败：{exc}") from exc

    slot = "p1" if str(user.id) == room.p1_id else "p2"
    elo_change = result["elo_change"].get(slot, 0)
    return MatchSurrenderResponse(result="loss", elo_change=elo_change)
