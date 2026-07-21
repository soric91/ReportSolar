"""add fotos JSON column to reportes

Revision ID: 006
Revises: 005
Create Date: 2026-07-10
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reportes", sa.Column("fotos", sa.JSON, server_default="[]"))


def downgrade() -> None:
    op.drop_column("reportes", "fotos")
