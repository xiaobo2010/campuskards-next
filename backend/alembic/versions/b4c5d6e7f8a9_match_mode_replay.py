"""Add match mode, end_reason, replay_data

Revision ID: b4c5d6e7f8a9
Revises: a1b2c3d4e5f6
Create Date: 2026-06-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("mode", sa.String(length=16), server_default="quick", nullable=False))
    op.add_column("matches", sa.Column("end_reason", sa.String(length=32), nullable=True))
    op.add_column("matches", sa.Column("replay_data", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "replay_data")
    op.drop_column("matches", "end_reason")
    op.drop_column("matches", "mode")
