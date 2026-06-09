"""Add token_version to users for JWT revocation

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-06-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = {col["name"] for col in inspector.get_columns("users")}

    # Safety net: c5d6e7f8a9b0 may have been stamped without running
    if "newbie_claimed" not in columns:
        op.add_column(
            "users",
            sa.Column("newbie_claimed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
        columns.add("newbie_claimed")

    if "token_version" not in columns:
        op.add_column(
            "users",
            sa.Column("token_version", sa.Integer(), nullable=False, server_default=sa.text("0")),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "token_version" in columns:
        op.drop_column("users", "token_version")
