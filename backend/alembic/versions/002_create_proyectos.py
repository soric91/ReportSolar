"""create proyectos and proyecto_tecnico tables

Revision ID: 002
Revises: 001
Create Date: 2026-07-06
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "proyectos",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("cliente", sa.String(200), nullable=False),
        sa.Column("direccion", sa.String(300), nullable=False),
        sa.Column(
            "tipo_sistema",
            sa.Enum("on_grid", "off_grid", "hibrido", name="tiposistemaenum"),
            nullable=False,
            server_default="on_grid",
        ),
        sa.Column("componentes", sa.JSON(), server_default="{}"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    op.create_table(
        "proyecto_tecnico",
        sa.Column(
            "proyecto_id", sa.Integer(), sa.ForeignKey("proyectos.id"), primary_key=True
        ),
        sa.Column(
            "tecnico_id", sa.Integer(), sa.ForeignKey("usuarios.id"), primary_key=True
        ),
    )


def downgrade() -> None:
    op.drop_table("proyecto_tecnico")
    op.drop_table("proyectos")
    op.execute("DROP TYPE IF EXISTS tiposistemaenum")
