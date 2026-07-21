"""Add performance indexes for common queries

Revision ID: 007
Revises: 006_add_fotos_json_to_reportes
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Indexes on reportes table for common filters
    op.create_index(
        'idx_reporte_tecnico_id',
        'reportes',
        ['tecnico_id'],
        postgresql_where=sa.text('tecnico_id IS NOT NULL')
    )
    op.create_index(
        'idx_reporte_proyecto_id',
        'reportes',
        ['proyecto_id'],
        postgresql_where=sa.text('proyecto_id IS NOT NULL')
    )
    op.create_index(
        'idx_reporte_created_at',
        'reportes',
        ['created_at'],
        postgresql_where=sa.text('created_at IS NOT NULL')
    )

    # Indexes on proyectos table
    op.create_index(
        'idx_proyecto_cliente',
        'proyectos',
        ['cliente']
    )

    # Indexes on usuarios table
    op.create_index(
        'idx_usuario_email',
        'usuarios',
        ['email']
    )
    op.create_index(
        'idx_usuario_rol',
        'usuarios',
        ['rol']
    )

    # Composite index for common proyecto_tecnico queries
    op.create_index(
        'idx_proyecto_tecnico_composite',
        'proyecto_tecnico',
        ['proyecto_id', 'tecnico_id']
    )


def downgrade() -> None:
    op.drop_index('idx_proyecto_tecnico_composite', table_name='proyecto_tecnico')
    op.drop_index('idx_usuario_rol', table_name='usuarios')
    op.drop_index('idx_usuario_email', table_name='usuarios')
    op.drop_index('idx_proyecto_cliente', table_name='proyectos')
    op.drop_index('idx_reporte_created_at', table_name='reportes')
    op.drop_index('idx_reporte_proyecto_id', table_name='reportes')
    op.drop_index('idx_reporte_tecnico_id', table_name='reportes')
