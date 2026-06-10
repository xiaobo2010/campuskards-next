"""add user_checkins table

Revision ID: 3690c463404a
Revises: e8f9a0b1c2d3
Create Date: 2026-06-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3690c463404a"
down_revision: Union[str, None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_checkins",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("checkin_date", sa.Date(), server_default=sa.func.current_date(), nullable=False),
        sa.Column("streak", sa.Integer(), server_default="1", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "checkin_date"),
    )


def downgrade() -> None:
    op.drop_table("user_checkins")
