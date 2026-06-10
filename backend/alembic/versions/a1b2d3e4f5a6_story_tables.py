"""add story mode tables

Revision ID: a1b2d3e4f5a6
Revises: 3690c463404a
Create Date: 2026-06-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a1b2d3e4f5a6"
down_revision: Union[str, None] = "3690c463404a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "story_chapters",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("chapter_num", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(64), nullable=False),
        sa.Column("subtitle", sa.String(128), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_image", sa.String(512), nullable=True),
        sa.Column("unlock_elo", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chapter_num"),
    )

    op.create_table(
        "story_levels",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("chapter_id", sa.Uuid(), sa.ForeignKey("story_chapters.id"), nullable=False),
        sa.Column("level_num", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(64), nullable=False),
        sa.Column("enemy_name", sa.String(64), nullable=False),
        sa.Column("enemy_faction", sa.String(64), nullable=False),
        sa.Column("enemy_deck_id", sa.Uuid(), sa.ForeignKey("decks.id"), nullable=False),
        sa.Column("difficulty", sa.String(16), server_default="medium", nullable=False),
        sa.Column("ink_reward", sa.Integer(), server_default="200", nullable=False),
        sa.Column("card_reward_ids", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("special_rules", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("unlock_previous", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("max_turns", sa.Integer(), server_default="0", nullable=False),
        sa.Column("star_conditions", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chapter_id", "level_num"),
    )

    op.create_table(
        "user_story_progress",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("level_id", sa.Uuid(), sa.ForeignKey("story_levels.id"), nullable=False),
        sa.Column("completed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("stars", sa.Integer(), server_default="0", nullable=False),
        sa.Column("best_turns", sa.Integer(), nullable=True),
        sa.Column("best_hp_remaining", sa.Integer(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("rewards_claimed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "level_id"),
    )


def downgrade() -> None:
    op.drop_table("user_story_progress")
    op.drop_table("story_levels")
    op.drop_table("story_chapters")
