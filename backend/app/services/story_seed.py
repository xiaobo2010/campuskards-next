"""Seed story mode: chapters, levels, bot users and bot decks.

Usage:
    python -m app.services.story_seed
"""

import asyncio
import uuid

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession as _AsyncSessionLocal

from app.core.database import async_session
from app.models import User as _User, Deck as _Deck, DeckCard as _DeckCard, Card as _Card
from app.models.story import StoryChapter, StoryLevel
from app.services.story_bot_decks import STORY_BOT_DECKS

# ─── Chapter definitions ───
CHAPTERS = [
    {
        "chapter_num": 1,
        "title": "新生报到",
        "subtitle": "踏入校园的第一步",
        "description": "你刚刚转学到这所高中，一切都是新鲜的。在接下来的日子里，你会遇到各路高手，也会找到属于自己的位置。",
        "unlock_elo": 0,
    },
    {
        "chapter_num": 2,
        "title": "班级争霸",
        "subtitle": "谁是真正的王者",
        "description": "班级之间的较量悄然展开。重点班、国际班、竞赛班……每个班级都有自己的王牌。你需要证明自己。",
        "unlock_elo": 0,
    },
    {
        "chapter_num": 3,
        "title": "校园巅峰",
        "subtitle": "最强学生的荣耀",
        "description": "你已经击败了许多对手，现在只剩下最强的几个人。学生会长、教导主任……校园的最强王者究竟是谁？",
        "unlock_elo": 1000,
    },
]

# ─── Level definitions ───
LEVELS = [
    # Chapter 1
    {"chapter_num": 1, "level_num": 1, "title": "初识对决", "enemy_name": "体育委员-李明", "enemy_faction": "arts_class", "deck_key": "ch1_l1", "difficulty": "easy", "ink_reward": 150,
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥60%", "type": "hp_percent", "threshold": 60},
         {"desc": "回合数≤15", "type": "max_turns", "threshold": 15},
     ]},
    {"chapter_num": 1, "level_num": 2, "title": "学霸的考验", "enemy_name": "学习委员-王芳", "enemy_faction": "key_class", "deck_key": "ch1_l2", "difficulty": "easy", "ink_reward": 180,
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥50%", "type": "hp_percent", "threshold": 50},
         {"desc": "回合数≤12", "type": "max_turns", "threshold": 12},
     ]},
    {"chapter_num": 1, "level_num": 3, "title": "班级代表", "enemy_name": "班长-刘婷", "enemy_faction": "normal_class", "deck_key": "ch1_l3", "difficulty": "medium", "ink_reward": 250,
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥40%", "type": "hp_percent", "threshold": 40},
         {"desc": "回合数≤18", "type": "max_turns", "threshold": 18},
     ]},
    {"chapter_num": 1, "level_num": 4, "title": "学生会长", "enemy_name": "学生会长-周浩", "enemy_faction": "competition_class", "deck_key": "ch1_boss", "difficulty": "hard", "ink_reward": 500, "card_reward_ids": ["cc_active_002"],
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥30%", "type": "hp_percent", "threshold": 30},
         {"desc": "回合数≤20", "type": "max_turns", "threshold": 20},
     ]},

    # Chapter 2
    {"chapter_num": 2, "level_num": 1, "title": "重点班挑战", "enemy_name": "数学课代表-陈涛", "enemy_faction": "key_class", "deck_key": "ch2_l1", "difficulty": "medium", "ink_reward": 300,
     "special_rules": {"starting_ink": 2},
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥50%", "type": "hp_percent", "threshold": 50},
         {"desc": "回合数≤15", "type": "max_turns", "threshold": 15},
     ]},
    {"chapter_num": 2, "level_num": 2, "title": "国际班交流", "enemy_name": "国际部代表-Anna", "enemy_faction": "intl_class", "deck_key": "ch2_l2", "difficulty": "medium", "ink_reward": 350,
     "special_rules": {"enemy_ink_bonus": 1},
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥40%", "type": "hp_percent", "threshold": 40},
         {"desc": "回合数≤18", "type": "max_turns", "threshold": 18},
     ]},
    {"chapter_num": 2, "level_num": 3, "title": "竞赛班较量", "enemy_name": "竞赛班选手-赵磊", "enemy_faction": "competition_class", "deck_key": "ch2_l3", "difficulty": "hard", "ink_reward": 450,
     "special_rules": {"enemy_hq_hp_bonus": 5},
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥30%", "type": "hp_percent", "threshold": 30},
         {"desc": "回合数≤20", "type": "max_turns", "threshold": 20},
     ]},
    {"chapter_num": 2, "level_num": 4, "title": "年级组长", "enemy_name": "年级组长-钱主任", "enemy_faction": "key_class", "deck_key": "ch2_boss", "difficulty": "hard", "ink_reward": 800, "card_reward_ids": ["kc_active_001"],
     "special_rules": {"enemy_ink_bonus": 2, "enemy_hq_hp_bonus": 10},
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥25%", "type": "hp_percent", "threshold": 25},
         {"desc": "回合数≤25", "type": "max_turns", "threshold": 25},
     ]},

    # Chapter 3
    {"chapter_num": 3, "level_num": 1, "title": "国际精英", "enemy_name": "国际班精英-Michael", "enemy_faction": "intl_class", "deck_key": "ch3_l1", "difficulty": "hard", "ink_reward": 500,
     "special_rules": {"starting_ink": 3, "enemy_ink_bonus": 1},
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥40%", "type": "hp_percent", "threshold": 40},
         {"desc": "回合数≤20", "type": "max_turns", "threshold": 20},
     ]},
    {"chapter_num": 3, "level_num": 2, "title": "艺术大师", "enemy_name": "艺术大咖-林雨", "enemy_faction": "arts_class", "deck_key": "ch3_l2", "difficulty": "hard", "ink_reward": 600, "card_reward_ids": ["ac_active_003"],
     "special_rules": {"starting_ink": 3, "enemy_hq_hp_bonus": 10},
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥30%", "type": "hp_percent", "threshold": 30},
         {"desc": "回合数≤22", "type": "max_turns", "threshold": 22},
     ]},
    {"chapter_num": 3, "level_num": 3, "title": "最终挑战", "enemy_name": "教导主任", "enemy_faction": "neutral", "deck_key": "ch3_l3", "difficulty": "expert", "ink_reward": 1000, "card_reward_ids": ["ne_active_001"],
     "special_rules": {"starting_ink": 3, "enemy_ink_bonus": 2, "enemy_hq_hp_bonus": 15},
     "star_conditions": [
         {"desc": "获胜", "type": "win", "threshold": None},
         {"desc": "HQ剩余HP≥20%", "type": "hp_percent", "threshold": 20},
         {"desc": "回合数≤25", "type": "max_turns", "threshold": 25},
     ]},
]


async def _create_bot(db, username: str, faction: str) -> uuid.UUID:
    """Create a story bot user with a unique UUID."""
    bot_id = uuid.uuid4()
    user = _User(
        id=bot_id,
        username=username,
        email=f"storybot_{bot_id.hex[:8]}@internal",
        password_hash="$story_bot$",
    )
    db.add(user)
    return bot_id


async def _create_bot_deck(db, user_id: uuid.UUID, deck_config: dict) -> uuid.UUID:
    """Create a deck for a story bot user using pre-configured card lists."""
    deck_id = uuid.uuid4()
    deck = _Deck(
        id=deck_id,
        user_id=user_id,
        name=deck_config["name"],
        faction_code=deck_config["faction"],
        is_default=True,
    )
    db.add(deck)

    for card_id, qty in deck_config["cards"]:
        # Verify card exists
        exists = await db.get(_Card, card_id)
        if not exists:
            continue
        entry = _DeckCard(deck_id=deck_id, card_id=card_id, quantity=qty)
        db.add(entry)

    return deck_id


async def seed_story(db=None) -> dict:
    """Run story mode seed — idempotent."""
    result = {"chapters_inserted": 0, "levels_inserted": 0, "bots_created": 0, "decks_created": 0}

    if db is None:
        async with async_session() as session:
            return await _do_seed_story(session, result)
    return await _do_seed_story(db, result)


async def _do_seed_story(db, result: dict) -> dict:
    # ── 1. Create or update chapters ──
    chapter_map: dict[int, uuid.UUID] = {}
    for ch_def in CHAPTERS:
        chapter_result = await db.execute(
            sa.select(StoryChapter).where(StoryChapter.chapter_num == ch_def["chapter_num"])
        )
        existing = chapter_result.scalar_one_or_none()
        if not existing:
            ch = StoryChapter(**ch_def)
            db.add(ch)
            result["chapters_inserted"] += 1
            await db.flush()
            chapter_map[ch_def["chapter_num"]] = ch.id
        else:
            chapter_map[ch_def["chapter_num"]] = existing.id

    # ── 2. Create bot users and decks for each level ──
    bot_cache: dict[str, uuid.UUID] = {}  # deck_key → bot_user_id
    deck_cache: dict[str, uuid.UUID] = {}  # deck_key → deck_id

    for deck_key, deck_cfg in STORY_BOT_DECKS.items():
        # Check if a bot with this username already exists
        username = deck_cfg["username"]
        user_result = await db.execute(
            sa.select(_User).where(_User.username == username).limit(1)
        )
        bot_user = user_result.scalar_one_or_none()

        if not bot_user:
            bot_id = await _create_bot(db, username, deck_cfg["faction"])
            result["bots_created"] += 1
            await db.flush()
            bot_cache[deck_key] = bot_id

            deck_id = await _create_bot_deck(db, bot_id, deck_cfg)
            result["decks_created"] += 1
            await db.flush()
            deck_cache[deck_key] = deck_id
        else:
            bot_cache[deck_key] = bot_user.id

            # Check if bot already has a default deck matching this deck_key
            deck_result = await db.execute(
                sa.select(_Deck).where(
                    _Deck.user_id == bot_user.id,
                    _Deck.name == deck_cfg["name"],
                ).limit(1)
            )
            bot_deck = deck_result.scalar_one_or_none()
            if bot_deck:
                deck_cache[deck_key] = bot_deck.id
            else:
                deck_id = await _create_bot_deck(db, bot_user.id, deck_cfg)
                result["decks_created"] += 1
                await db.flush()
                deck_cache[deck_key] = deck_id

    # ── 3. Create or update levels ──
    for lv_def in LEVELS:
        ch_id = chapter_map[lv_def["chapter_num"]]
        level_result = await db.execute(
            sa.select(StoryLevel).where(
                StoryLevel.chapter_id == ch_id,
                StoryLevel.level_num == lv_def["level_num"],
            )
        )
        existing = level_result.scalar_one_or_none()

        deck_key = lv_def.get("deck_key")
        card_rewards = lv_def.get("card_reward_ids", [])
        lv_def["card_reward_ids"] = card_rewards
        deck_id = deck_cache.get(deck_key)
        if deck_id is None:
            continue

        if not existing:
            level = StoryLevel(
                chapter_id=ch_id,
                level_num=lv_def["level_num"],
                title=lv_def["title"],
                enemy_name=lv_def["enemy_name"],
                enemy_faction=lv_def["enemy_faction"],
                enemy_deck_id=deck_id,
                difficulty=lv_def.get("difficulty", "medium"),
                ink_reward=lv_def.get("ink_reward", 200),
                card_reward_ids=lv_def.get("card_reward_ids", []),
                special_rules=lv_def.get("special_rules", {}),
                star_conditions=lv_def.get("star_conditions", []),
            )
            db.add(level)
            result["levels_inserted"] += 1
        else:
            existing.title = lv_def["title"]
            existing.enemy_name = lv_def["enemy_name"]
            existing.enemy_faction = lv_def["enemy_faction"]
            existing.enemy_deck_id = deck_id
            existing.difficulty = lv_def.get("difficulty", "medium")
            existing.ink_reward = lv_def.get("ink_reward", 200)
            existing.card_reward_ids = lv_def.get("card_reward_ids", [])
            existing.special_rules = lv_def.get("special_rules", {})
            existing.star_conditions = lv_def.get("star_conditions", [])

    await db.commit()
    return result


if __name__ == "__main__":
    import sys
    sys.path.insert(0, ".")
    r = asyncio.run(seed_story())
    print(f"Chapters: {r['chapters_inserted']} new")
    print(f"Levels: {r['levels_inserted']} new")
    print(f"Bots: {r['bots_created']} new")
    print(f"Decks: {r['decks_created']} new")
