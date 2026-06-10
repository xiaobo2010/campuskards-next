from pydantic import BaseModel
from datetime import datetime
import uuid


# ─── Request schemas ───

class StoryPlayRequest(BaseModel):
    deck_id: str
    level_id: str


class StoryCompleteRequest(BaseModel):
    match_id: str
    level_id: str
    stars: int = 0
    best_turns: int | None = None
    best_hp_remaining: int | None = None


# ─── Response schemas ───

class StarConditionOut(BaseModel):
    desc: str
    type: str
    threshold: int | None = None


class StorySpecialRulesOut(BaseModel):
    starting_ink: int = 1
    enemy_ink_bonus: int = 0
    enemy_hq_hp_bonus: int = 0
    banned_factions: list[str] = []
    passive_effects: dict[str, str] = {}


class StoryLevelSummaryOut(BaseModel):
    id: str
    level_num: int
    title: str
    enemy_name: str
    difficulty: str
    unlocked: bool
    completed: bool
    stars: int
    rewards: dict


class StoryLevelDetailOut(StoryLevelSummaryOut):
    enemy_faction: str
    special_rules: StorySpecialRulesOut
    star_conditions: list[StarConditionOut]
    max_turns: int


class StoryChapterOut(BaseModel):
    id: str
    chapter_num: int
    title: str
    subtitle: str | None = None
    cover_image: str | None = None
    unlocked: bool
    total_levels: int
    completed_levels: int
    total_stars: int
    levels: list[StoryLevelSummaryOut]


class StoryChaptersResponse(BaseModel):
    chapters: list[StoryChapterOut]


class StoryPlayResponse(BaseModel):
    status: str
    mode: str
    match_id: str
    level_id: str
    enemy_name: str
    enemy_faction: str
    difficulty: str
    star_conditions: list[StarConditionOut]
    special_rules: StorySpecialRulesOut


class StoryProgressResponse(BaseModel):
    total_levels: int
    completed_levels: int
    total_stars: int
    chapters_completed: int
