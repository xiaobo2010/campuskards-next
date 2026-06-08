"""add_reset_key_and_ink

Revision ID: a1b2c3d4e5f6
Revises: 3c1a47e80688
Create Date: 2026-06-06 06:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3c1a47e80688'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add reset_key column (nullable, for password reset functionality)
    op.add_column('users', sa.Column('reset_key', sa.String(length=64), nullable=True))

    # Add ink column if not exists (currency for card packs)
    # Using batch mode for safer migration
    # Note: ink may already exist from initial migration; this handles both cases
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('users')]

    if 'ink' not in columns:
        op.add_column('users', sa.Column('ink', sa.Integer(), nullable=False, server_default='500'))
        # Remove server_default after setting initial values
        op.alter_column('users', 'ink', server_default=None)


def downgrade() -> None:
    op.drop_column('users', 'ink')
    op.drop_column('users', 'reset_key')
