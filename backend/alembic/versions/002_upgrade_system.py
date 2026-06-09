"""Add avatar_url to users and level/fragments to user_cards

Revision ID: 002_upgrade_system
Revises: b4c5d6e7f8a9
Create Date: 2024-01-XX

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = '002_upgrade_system'
down_revision = 'b4c5d6e7f8a9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add avatar_url to users table
    op.add_column('users', sa.Column('avatar_url', sa.String(512), nullable=True))
    
    # Add level and fragments to user_cards table
    op.add_column('user_cards', sa.Column('level', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('user_cards', sa.Column('fragments', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('user_cards', 'fragments')
    op.drop_column('user_cards', 'level')
    op.drop_column('users', 'avatar_url')
