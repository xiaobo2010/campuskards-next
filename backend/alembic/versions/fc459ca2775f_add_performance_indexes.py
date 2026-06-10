""" add_performance_indexes

Revision ID: fc459ca2775f
Revises: a1b2d3e4f5a6
Create Date: 2026-06-10 13:40:15.812651
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'fc459ca2775f'
down_revision: Union[str, None] = 'a1b2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_matches_p1_id", "matches", ["p1_id"])
    op.create_index("ix_matches_p2_id", "matches", ["p2_id"])
    op.create_index("ix_matches_winner_id", "matches", ["winner_id"])
    op.create_index("ix_matches_mode", "matches", ["mode"])
    op.create_index("ix_matches_ended_at", "matches", ["ended_at"])
    op.create_index("ix_user_cards_user_id", "user_cards", ["user_id"])
    op.create_index("ix_announcements_author_id", "announcements", ["author_id"])
    op.create_index("ix_admin_audit_logs_admin_id", "admin_audit_logs", ["admin_id"])
    op.create_index("ix_admin_audit_logs_created_at", "admin_audit_logs", ["created_at"])
    op.create_index("ix_story_levels_chapter_id", "story_levels", ["chapter_id"])


def downgrade() -> None:
    op.drop_index("ix_story_levels_chapter_id", table_name="story_levels")
    op.drop_index("ix_admin_audit_logs_created_at", table_name="admin_audit_logs")
    op.drop_index("ix_admin_audit_logs_admin_id", table_name="admin_audit_logs")
    op.drop_index("ix_announcements_author_id", table_name="announcements")
    op.drop_index("ix_user_cards_user_id", table_name="user_cards")
    op.drop_index("ix_matches_ended_at", table_name="matches")
    op.drop_index("ix_matches_mode", table_name="matches")
    op.drop_index("ix_matches_winner_id", table_name="matches")
    op.drop_index("ix_matches_p2_id", table_name="matches")
    op.drop_index("ix_matches_p1_id", table_name="matches")
