"""add foto_url to reportes

Revision ID: 004
Revises: 003
Create Date: 2026-07-06
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reportes", sa.Column("foto_url", sa.String(500), server_default=""))


def downgrade() -> None:
    op.drop_column("reportes", "foto_url")
