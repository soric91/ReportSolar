"""initial create usuarios table

Revision ID: 001
Revises:
Create Date: 2026-07-06
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("email", sa.String(150), unique=True, nullable=False, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column(
            "rol",
            sa.Enum("administrador", "tecnico", name="rolenum"),
            nullable=False,
            server_default="tecnico",
        ),
        sa.Column(
            "estado",
            sa.Enum("activo", "inactivo", name="estadoenum"),
            nullable=False,
            server_default="activo",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("usuarios")
    op.execute("DROP TYPE IF EXISTS rolenum")
    op.execute("DROP TYPE IF EXISTS estadoenum")
