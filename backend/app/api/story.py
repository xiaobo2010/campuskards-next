"""Story mode API — /api/story"""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.auth import _get_current_user
from app.api.decks import _load_deck, _validate_deck_entries
from app.api.match import _start_match
from app.models import User
from app.models.story import StoryChapter, StoryLevel, UserStoryProgress
from app.schemas.story import (
    StoryChaptersResponse,
    StoryChapterOut,
    StoryLevelSummaryOut,
    StoryLevelDetailOut,
    StarConditionOut,
    StorySpecialRulesOut,
    StoryPlayRequest,
    StoryPlayResponse,
    StoryCompleteRequest,
    StoryProgressResponse,
)
from app.services.matchmaking import MatchTicket
from app.services.pve_bot import ensure_pve_bot, BOT_USER_ID, BOT_USERNAME

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/story", tags=["story"])

UTC = timezone.utc


async def _get_progress(db: AsyncSession, user_id: uuid.UUID) -> dict[str, UserStoryProgress]:
    """Return {level_id_str: UserStoryProgress} for a user."""
    stmt = select(UserStoryProgress).where(UserStoryProgress.user_id == user_id)
    rows = (await db.execute(stmt)).scalars().all()
    return {str(r.level_id): r for r in rows}


async def _user_completed_previous(
    db: AsyncSession, user_id: uuid.UUID, level: StoryLevel, chapter: StoryChapter,
    completed_ids: set[str] | None = None,
    level_id_by_chapter_num: dict[tuple[uuid.UUID, int], str] | None = None,
    chapter_id_by_num: dict[int, uuid.UUID] | None = None,
) -> bool:
    """Check if the previous level (in chapter or across chapters) is completed."""
    if not level.unlock_previous:
        return True

    if completed_ids is not None and level_id_by_chapter_num is not None and chapter_id_by_num is not None:
        return _check_level_unlocked(
            level_id_by_chapter_num, chapter_id_by_num, completed_ids,
            chapter.id, level.level_num, chapter.chapter_num,
        )

    # Fallback: DB queries (used by single-call endpoints)
    if level.level_num > 1:
        prev_stmt = select(StoryLevel).where(
            StoryLevel.chapter_id == chapter.id,
            StoryLevel.level_num == level.level_num - 1,
        )
        prev = (await db.execute(prev_stmt)).scalar_one_or_none()
        if prev:
            prog = await db.execute(
                select(UserStoryProgress).where(
                    UserStoryProgress.user_id == user_id,
                    UserStoryProgress.level_id == prev.id,
                    UserStoryProgress.completed == True,
                )
            )
            if prog.scalar_one_or_none() is None:
                return False
    if level.level_num == 1 and chapter.chapter_num > 1:
        prev_ch_stmt = select(StoryChapter).where(
            StoryChapter.chapter_num == chapter.chapter_num - 1,
        )
        prev_ch = (await db.execute(prev_ch_stmt)).scalar_one_or_none()
        if prev_ch:
            last_level_stmt = (
                select(StoryLevel)
                .where(StoryLevel.chapter_id == prev_ch.id)
                .order_by(StoryLevel.level_num.desc())
                .limit(1)
            )
            last_level = (await db.execute(last_level_stmt)).scalar_one_or_none()
            if last_level:
                prog = await db.execute(
                    select(UserStoryProgress).where(
                        UserStoryProgress.user_id == user_id,
                        UserStoryProgress.level_id == last_level.id,
                        UserStoryProgress.completed == True,
                    )
                )
                if prog.scalar_one_or_none() is None:
                    return False
    return True


def _check_level_unlocked(
    level_id_by_chapter_num: dict[tuple[uuid.UUID, int], str],
    chapter_id_by_num: dict[int, uuid.UUID],
    completed_ids: set[str],
    chapter_id: uuid.UUID,
    level_num: int,
    chapter_num: int,
) -> bool:
    """Pure O(1) lookup version — no DB access."""
    if level_num > 1:
        prev_lv_id = level_id_by_chapter_num.get((chapter_id, level_num - 1))
        return prev_lv_id is not None and prev_lv_id in completed_ids
    if level_num == 1 and chapter_num > 1:
        prev_ch_id = chapter_id_by_num.get(chapter_num - 1)
        if prev_ch_id:
            prev_level_nums = [
                lnum for (cid, lnum) in level_id_by_chapter_num if cid == prev_ch_id
            ]
            if prev_level_nums:
                last_level_num = max(prev_level_nums)
                last_lv_id = level_id_by_chapter_num.get((prev_ch_id, last_level_num))
                return last_lv_id is not None and last_lv_id in completed_ids
    return True


# ─── Endpoints ───


@router.get("/chapters", response_model=StoryChaptersResponse)
async def list_chapters(
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StoryChaptersResponse:
    """List all chapters with levels and user progress."""
    chapters_result = await db.execute(
        select(StoryChapter)
        .where(StoryChapter.is_active == True)
        .options(selectinload(StoryChapter.levels))
        .order_by(StoryChapter.sort_order, StoryChapter.chapter_num)
    )
    chapters = chapters_result.scalars().all()

    progress_map = await _get_progress(db, user.id)

    # Pre-build O(1) lookup maps to avoid N+1 queries in _user_completed_previous
    level_id_by_chapter_key: dict[tuple[uuid.UUID, int], str] = {}
    chapter_id_by_num: dict[int, uuid.UUID] = {}
    completed_ids: set[str] = set()
    for ch in chapters:
        chapter_id_by_num[ch.chapter_num] = ch.id
        for lv in ch.levels:
            lv_id_str = str(lv.id)
            level_id_by_chapter_key[(ch.id, lv.level_num)] = lv_id_str
            prog = progress_map.get(lv_id_str)
            if prog and prog.completed:
                completed_ids.add(lv_id_str)

    out: list[StoryChapterOut] = []
    for ch in chapters:
        levels = sorted([l for l in ch.levels if l.is_active], key=lambda l: l.level_num)
        chapter_unlocked = True
        if ch.unlock_elo > 0 and (user.elo or 0) < ch.unlock_elo:
            chapter_unlocked = False

        level_summaries: list[StoryLevelSummaryOut] = []
        total_stars = 0
        completed_count = 0

        for lv in levels:
            prog = progress_map.get(str(lv.id))
            completed = prog.completed if prog else False
            stars = prog.stars if prog else 0
            total_stars += stars
            if completed:
                completed_count += 1

            # A level is unlocked if: chapter is unlocked AND previous level completed
            key = str(lv.id)
            if not chapter_unlocked:
                unlocked = False
            elif key in progress_map and progress_map[key].completed:
                unlocked = True
            else:
                unlocked = await _user_completed_previous(
                    db, user.id, lv, ch,
                    completed_ids=completed_ids,
                    level_id_by_chapter_num=level_id_by_chapter_key,
                    chapter_id_by_num=chapter_id_by_num,
                )

            rewards: dict = {
                "ink": lv.ink_reward,
                "cards": lv.card_reward_ids if lv.card_reward_ids else [],
            }
            level_summaries.append(
                StoryLevelSummaryOut(
                    id=str(lv.id),
                    level_num=lv.level_num,
                    title=lv.title,
                    enemy_name=lv.enemy_name,
                    difficulty=lv.difficulty,
                    unlocked=unlocked,
                    completed=completed,
                    stars=stars,
                    rewards=rewards,
                )
            )

        out.append(
            StoryChapterOut(
                id=str(ch.id),
                chapter_num=ch.chapter_num,
                title=ch.title,
                subtitle=ch.subtitle,
                cover_image=ch.cover_image,
                unlocked=chapter_unlocked,
                total_levels=len(levels),
                completed_levels=completed_count,
                total_stars=total_stars,
                levels=level_summaries,
            )
        )

    return StoryChaptersResponse(chapters=out)


@router.get("/chapters/{chapter_id}", response_model=StoryChapterOut)
async def get_chapter(
    chapter_id: uuid.UUID,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StoryChapterOut:
    result = await list_chapters(user, db)
    for ch in result.chapters:
        if ch.id == str(chapter_id):
            return ch
    raise HTTPException(status_code=404, detail="章节不存在")


@router.get("/levels/{level_id}", response_model=StoryLevelDetailOut)
async def get_level_detail(
    level_id: uuid.UUID,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StoryLevelDetailOut:
    """Get detailed info for a specific level."""
    level = await db.get(StoryLevel, level_id)
    if not level or not level.is_active:
        raise HTTPException(status_code=404, detail="关卡不存在")

    ch = await db.get(StoryChapter, level.chapter_id)
    if not ch:
        raise HTTPException(status_code=404, detail="章节不存在")

    # Check unlock
    if ch.unlock_elo > 0 and (user.elo or 0) < ch.unlock_elo:
        raise HTTPException(status_code=403, detail="ELO不足，无法查看此关卡")
    if not await _user_completed_previous(db, user.id, level, ch):
        raise HTTPException(status_code=403, detail="请先通关前置关卡")

    progress_map = await _get_progress(db, user.id)
    prog = progress_map.get(str(level.id))

    star_conditions = [
        StarConditionOut(**sc) for sc in (level.star_conditions or [])
    ]
    special_rules = StorySpecialRulesOut(**(level.special_rules or {}))

    return StoryLevelDetailOut(
        id=str(level.id),
        level_num=level.level_num,
        title=level.title,
        enemy_name=level.enemy_name,
        enemy_faction=level.enemy_faction,
        difficulty=level.difficulty,
        unlocked=True,
        completed=prog.completed if prog else False,
        stars=prog.stars if prog else 0,
        rewards={"ink": level.ink_reward, "cards": level.card_reward_ids or []},
        special_rules=special_rules,
        star_conditions=star_conditions,
        max_turns=level.max_turns or 0,
    )


@router.post("/play", response_model=StoryPlayResponse)
async def start_story_level(
    body: StoryPlayRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StoryPlayResponse:
    """Start a story level match."""
    from app.services.matchmaking import matchmaking

    # Prevent double-queue/double-match
    status = await matchmaking.get_status(str(user.id))
    if status.get("status") == "matched":
        raise HTTPException(status_code=400, detail="已有进行中的对战")
    if status.get("status") == "queued":
        raise HTTPException(status_code=400, detail="请先取消匹配队列")

    # Load level
    try:
        level_id = uuid.UUID(body.level_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的关卡ID")

    level = await db.get(StoryLevel, level_id)
    if not level or not level.is_active:
        raise HTTPException(status_code=404, detail="关卡不存在")

    ch = await db.get(StoryChapter, level.chapter_id)
    if not ch or not ch.is_active:
        raise HTTPException(status_code=404, detail="章节不存在")

    if ch.unlock_elo > 0 and (user.elo or 0) < ch.unlock_elo:
        raise HTTPException(status_code=403, detail="ELO不足，无法解锁此章节")

    if not await _user_completed_previous(db, user.id, level, ch):
        raise HTTPException(status_code=403, detail="请先通关前置关卡")

    # Validate deck
    deck = await _load_deck(db, uuid.UUID(body.deck_id))
    if not deck or deck.user_id != user.id:
        raise HTTPException(status_code=400, detail="卡组不存在或不属于当前用户")

    ok, errors, _dominant = await _validate_deck_entries(
        db, user, deck.faction_code, deck.entries, strict=True
    )
    if not ok:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    # Ensure PVE bot exists (bot user + a fallback deck)
    try:
        await ensure_pve_bot(db)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI系统初始化失败：{exc}") from exc

    ticket = MatchTicket(
        match_id=str(uuid.uuid4()),
        mode="story",
        p1_id=str(user.id),
        p1_username=user.username,
        p1_elo=user.elo,
        p1_deck_id=str(body.deck_id),
        p2_id=str(BOT_USER_ID),
        p2_username=level.enemy_name,
        p2_elo=user.elo,
        p2_deck_id=str(level.enemy_deck_id),
    )

    try:
        await _start_match(
            db,
            ticket,
            special_rules=level.special_rules if level.special_rules else None,
            bot_difficulty_override=level.difficulty,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"创建故事对局失败：{exc}") from exc

    star_conditions = [
        StarConditionOut(**sc) for sc in (level.star_conditions or [])
    ]
    special_rules = StorySpecialRulesOut(**(level.special_rules or {}))

    return StoryPlayResponse(
        status="matched",
        mode="story",
        match_id=ticket.match_id,
        level_id=str(level.id),
        enemy_name=level.enemy_name,
        enemy_faction=level.enemy_faction,
        difficulty=level.difficulty,
        star_conditions=star_conditions,
        special_rules=special_rules,
    )


@router.get("/progress", response_model=StoryProgressResponse)
async def get_progress(
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StoryProgressResponse:
    """Get overall story progress for the user."""
    progress_map = await _get_progress(db, user.id)

    total_levels_stmt = select(func.count()).select_from(StoryLevel).where(StoryLevel.is_active == True)
    total_levels = (await db.execute(total_levels_stmt)).scalar() or 0

    completed = sum(1 for p in progress_map.values() if p.completed)
    total_stars = sum(p.stars for p in progress_map.values())

    chapters_result = await db.execute(
        select(StoryChapter).where(StoryChapter.is_active == True)
    )
    chapters = chapters_result.scalars().all()

    chapters_completed = 0
    for ch in chapters:
        ch_level_stmt = select(StoryLevel.id).where(
            StoryLevel.chapter_id == ch.id,
            StoryLevel.is_active == True,
        )
        ch_level_rows = (await db.execute(ch_level_stmt)).scalars().all()
        ch_level_ids = {str(lid) for lid in ch_level_rows}
        level_count = len(ch_level_ids)
        if level_count == 0:
            continue
        completed_in_ch = sum(
            1 for lv_id, p in progress_map.items()
            if p.completed and lv_id in ch_level_ids
        )
        if completed_in_ch >= level_count:
            chapters_completed += 1

    return StoryProgressResponse(
        total_levels=total_levels,
        completed_levels=completed,
        total_stars=total_stars,
        chapters_completed=chapters_completed,
    )


@router.post("/complete")
async def complete_level(
    body: StoryCompleteRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Record story level completion after game over."""
    try:
        level_id = uuid.UUID(body.level_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的关卡ID")

    level = await db.get(StoryLevel, level_id)
    if not level:
        raise HTTPException(status_code=404, detail="关卡不存在")

    # Validate match
    try:
        match_id = uuid.UUID(body.match_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的对战ID")

    from app.models import Match
    match_row = await db.get(Match, match_id)
    if not match_row:
        raise HTTPException(status_code=400, detail="对战不存在")
    if user.id not in (match_row.p1_id, match_row.p2_id):
        raise HTTPException(status_code=403, detail="无权提交此对战结果")
    if match_row.mode != "story":
        raise HTTPException(status_code=400, detail="非故事模式对战")
    if not match_row.ended_at:
        raise HTTPException(status_code=400, detail="对战尚未结束")

    # Upsert progress
    stmt = select(UserStoryProgress).where(
        UserStoryProgress.user_id == user.id,
        UserStoryProgress.level_id == level_id,
    )
    result = await db.execute(stmt)
    progress = result.scalar_one_or_none()

    is_first_clear = False
    if not progress:
        progress = UserStoryProgress(
            user_id=user.id,
            level_id=level_id,
            completed=True,
            stars=body.stars,
            best_turns=body.best_turns,
            best_hp_remaining=body.best_hp_remaining,
            completed_at=datetime.now(UTC),
            rewards_claimed=False,
        )
        db.add(progress)
        is_first_clear = True
    else:
        progress.completed = True
        if body.stars > (progress.stars or 0):
            progress.stars = body.stars
        if body.best_turns is not None and (progress.best_turns is None or body.best_turns < progress.best_turns):
            progress.best_turns = body.best_turns
        if body.best_hp_remaining is not None and (progress.best_hp_remaining is None or body.best_hp_remaining > progress.best_hp_remaining):
            progress.best_hp_remaining = body.best_hp_remaining
        if not progress.completed_at:
            progress.completed_at = datetime.now(UTC)
            is_first_clear = True

    # Grant rewards on first clear
    reward_result: dict = {"ink": 0, "cards": [], "first_clear": is_first_clear}
    if is_first_clear and not progress.rewards_claimed:
        # Ink reward
        if level.ink_reward > 0:
            user_add = await db.get(User, user.id)
            if user_add:
                user_add.ink = (user_add.ink or 0) + level.ink_reward
                reward_result["ink"] = level.ink_reward
        # Card rewards (add to collection)
        card_ids = level.card_reward_ids or []
        if card_ids:
            from app.models import UserCard, Card
            for cid in card_ids:
                card = await db.get(Card, str(cid))
                if not card:
                    continue
                uc_stmt = select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == str(cid))
                uc_result = await db.execute(uc_stmt)
                uc = uc_result.scalar_one_or_none()
                if uc:
                    uc.count = (uc.count or 0) + 1
                else:
                    db.add(UserCard(user_id=user.id, card_id=str(cid), count=1))
                reward_result["cards"].append(str(cid))
        progress.rewards_claimed = True

    await db.commit()
    return reward_result
