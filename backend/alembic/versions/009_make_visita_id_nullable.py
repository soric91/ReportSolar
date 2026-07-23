"""make visita_id nullable

Revision ID: 009
Revises: 008
Create Date: 2026-07-23
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "reportes",
        "visita_id",
        existing_type=sa.Integer(),
        nullable=True,
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "reportes",
        "visita_id",
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=True,
    )
