"""create visitas, reportes, plantillas_informe tables and add plantilla_id to proyectos

Revision ID: 003
Revises: 002
Create Date: 2026-07-06
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plantillas_informe",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text(), server_default=""),
        sa.Column("encabezado", sa.JSON(), server_default="{}"),
        sa.Column("secciones", sa.JSON(), server_default="[]"),
        sa.Column("pie_pagina", sa.JSON(), server_default="{}"),
        sa.Column("colores", sa.JSON(), server_default="{}"),
        sa.Column("logo_url", sa.String(500), server_default=""),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    op.create_table(
        "visitas",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "proyecto_id", sa.Integer(), sa.ForeignKey("proyectos.id"), nullable=False
        ),
        sa.Column(
            "tecnico_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False
        ),
        sa.Column("fecha", sa.DateTime(), nullable=False),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("observaciones_generales", sa.Text(), server_default=""),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    op.create_table(
        "reportes",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "visita_id", sa.Integer(), sa.ForeignKey("visitas.id"), nullable=False
        ),
        sa.Column(
            "tecnico_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False
        ),
        sa.Column(
            "proyecto_id", sa.Integer(), sa.ForeignKey("proyectos.id"), nullable=False
        ),
        sa.Column("checklist", sa.JSON(), server_default="{}"),
        sa.Column("observaciones", sa.Text(), server_default=""),
        sa.Column("recomendaciones", sa.Text(), server_default=""),
        sa.Column("firma_url", sa.String(500), server_default=""),
        sa.Column("pdf_path", sa.String(500), server_default=""),
        sa.Column("estado_sync", sa.String(20), server_default="local"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    op.add_column(
        "proyectos",
        sa.Column(
            "plantilla_id",
            sa.Integer(),
            sa.ForeignKey("plantillas_informe.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("proyectos", "plantilla_id")
    op.drop_table("reportes")
    op.drop_table("visitas")
    op.drop_table("plantillas_informe")
