"""widen_faction_columns

Revision ID: 085f04087e35
Revises: d6e7f8a9b0c1
Create Date: 2026-06-09 20:35:53.817314
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '085f04087e35'
down_revision: Union[str, None] = 'd6e7f8a9b0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Widen faction_code columns from VARCHAR(16) to accommodate longer codes
    # like 'competition_class' (17 chars)
    op.alter_column("factions", "code", type_=sa.String(32), existing_type=sa.String(16))
    op.alter_column("cards", "faction_code", type_=sa.String(32), existing_type=sa.String(16))
    op.alter_column("decks", "faction_code", type_=sa.String(64), existing_type=sa.String(16))
    op.alter_column("decks", "ally_faction_code", type_=sa.String(32), existing_type=sa.String(16))


def downgrade() -> None:
    # Revert to VARCHAR(16) — will fail if data exceeds 16 chars
    op.alter_column("decks", "ally_faction_code", type_=sa.String(16), existing_type=sa.String(32))
    op.alter_column("decks", "faction_code", type_=sa.String(16), existing_type=sa.String(64))
    op.alter_column("cards", "faction_code", type_=sa.String(16), existing_type=sa.String(32))
    op.alter_column("factions", "code", type_=sa.String(16), existing_type=sa.String(32))
