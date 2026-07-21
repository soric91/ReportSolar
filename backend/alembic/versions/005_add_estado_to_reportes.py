"""add estado to reportes

Revision ID: 005
Revises: 004
Create Date: 2026-07-10
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reportes", sa.Column("estado", sa.String(20), server_default="borrador")
    )
    op.execute(
        "UPDATE reportes SET estado = 'completado' WHERE estado_sync = 'sincronizado'"
    )
    op.execute("UPDATE reportes SET estado = 'borrador' WHERE estado IS NULL")


def downgrade() -> None:
    op.drop_column("reportes", "estado")
