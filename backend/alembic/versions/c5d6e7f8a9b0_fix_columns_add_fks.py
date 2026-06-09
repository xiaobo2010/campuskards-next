"""Fix column sizes, add Match FKs, add newbie_claimed

Revision ID: c5d6e7f8a9b0
Revises: 002_upgrade_system
Create Date: 2026-06-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, None] = "002_upgrade_system"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("factions", "code", type_=sa.String(32), existing_type=sa.String(16))
    op.alter_column("decks", "ally_faction_code", type_=sa.String(32), existing_type=sa.String(16))
    op.alter_column("users", "reset_key", type_=sa.String(255), existing_type=sa.String(64))

    op.add_column("users", sa.Column("newbie_claimed", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    op.create_index(op.f("ix_users_role"), "users", ["role"])

    op.create_foreign_key(
        "fk_matches_winner_id_users",
        "matches", "users",
        ["winner_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_matches_p1_deck_id_decks",
        "matches", "decks",
        ["p1_deck_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_matches_p2_deck_id_decks",
        "matches", "decks",
        ["p2_deck_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_matches_p2_deck_id_decks", "matches", type_="foreignkey")
    op.drop_constraint("fk_matches_p1_deck_id_decks", "matches", type_="foreignkey")
    op.drop_constraint("fk_matches_winner_id_users", "matches", type_="foreignkey")

    op.drop_index(op.f("ix_users_role"), table_name="users")

    op.drop_column("users", "newbie_claimed")

    op.alter_column("users", "reset_key", type_=sa.String(64), existing_type=sa.String(255))
    op.alter_column("decks", "ally_faction_code", type_=sa.String(16), existing_type=sa.String(32))
    op.alter_column("factions", "code", type_=sa.String(16), existing_type=sa.String(32))
