"""Add progress tracking to reporte

Revision ID: 008
Revises: 007_add_performance_indexes
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('reportes', sa.Column('progreso', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('reportes', sa.Column('secciones_completadas', sa.JSON(), nullable=False, server_default='[]'))


def downgrade() -> None:
    op.drop_column('reportes', 'secciones_completadas')
    op.drop_column('reportes', 'progreso')
