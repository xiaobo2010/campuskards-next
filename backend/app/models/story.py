import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, func, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class StoryChapter(Base):
    __tablename__ = "story_chapters"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    chapter_num: Mapped[int] = mapped_column(unique=True)
    title: Mapped[str] = mapped_column(String(64))
    subtitle: Mapped[str | None] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text)
    cover_image: Mapped[str | None] = mapped_column(String(512))
    unlock_elo: Mapped[int] = mapped_column(default=0, server_default="0")
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    levels: Mapped[list["StoryLevel"]] = relationship(order_by="StoryLevel.level_num")


class StoryLevel(Base):
    __tablename__ = "story_levels"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    chapter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("story_chapters.id"))
    level_num: Mapped[int] = mapped_column()
    title: Mapped[str] = mapped_column(String(64))
    enemy_name: Mapped[str] = mapped_column(String(64))
    enemy_faction: Mapped[str] = mapped_column(String(64))
    enemy_deck_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("decks.id"))
    difficulty: Mapped[str] = mapped_column(String(16), default="medium", server_default="medium")
    ink_reward: Mapped[int] = mapped_column(default=200, server_default="200")
    card_reward_ids: Mapped[list] = mapped_column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    special_rules: Mapped[dict] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    unlock_previous: Mapped[bool] = mapped_column(default=True, server_default="true")
    max_turns: Mapped[int] = mapped_column(default=0, server_default="0")
    star_conditions: Mapped[list] = mapped_column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("chapter_id", "level_num"),
    )


class UserStoryProgress(Base):
    __tablename__ = "user_story_progress"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    level_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("story_levels.id"), primary_key=True)
    completed: Mapped[bool] = mapped_column(default=False, server_default="false")
    stars: Mapped[int] = mapped_column(default=0, server_default="0")
    best_turns: Mapped[int | None]
    best_hp_remaining: Mapped[int | None]
    completed_at: Mapped[datetime | None]
    rewards_claimed: Mapped[bool] = mapped_column(default=False, server_default="false")
    # onupdate only affects ORM writes; raw SQL/direct updates must set updated_at manually
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
