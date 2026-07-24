"""convert all integer ids/FKs to UUID

Revision ID: 010
Revises: 009
Create Date: 2026-07-24

Usuarios ya tiene filas (2) en produccion: la conversion de esa columna
usa `USING gen_random_uuid()`, que Postgres evalua por fila, asignando un
UUID nuevo y distinto a cada usuario existente. El resto de las tablas
(proyectos, plantillas_informe, visitas, reportes, proyecto_tecnico) estan
vacias, asi que el mismo patron simplemente cambia el tipo de columna sin
datos que preservar.
"""

from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None

FK_CONSTRAINTS = [
    ("proyecto_tecnico", "proyecto_tecnico_proyecto_id_fkey", "proyecto_id", "proyectos", "id"),
    ("proyecto_tecnico", "proyecto_tecnico_tecnico_id_fkey", "tecnico_id", "usuarios", "id"),
    ("visitas", "visitas_proyecto_id_fkey", "proyecto_id", "proyectos", "id"),
    ("visitas", "visitas_tecnico_id_fkey", "tecnico_id", "usuarios", "id"),
    ("reportes", "reportes_visita_id_fkey", "visita_id", "visitas", "id"),
    ("reportes", "reportes_tecnico_id_fkey", "tecnico_id", "usuarios", "id"),
    ("reportes", "reportes_proyecto_id_fkey", "proyecto_id", "proyectos", "id"),
    ("proyectos", "proyectos_plantilla_id_fkey", "plantilla_id", "plantillas_informe", "id"),
]

PK_ID_TABLES = ["usuarios", "proyectos", "plantillas_informe", "visitas", "reportes"]

FK_COLUMNS = [
    ("proyecto_tecnico", "proyecto_id"),
    ("proyecto_tecnico", "tecnico_id"),
    ("visitas", "proyecto_id"),
    ("visitas", "tecnico_id"),
    ("reportes", "visita_id"),
    ("reportes", "tecnico_id"),
    ("reportes", "proyecto_id"),
    ("proyectos", "plantilla_id"),
]


def upgrade() -> None:
    # 1. Drop FK constraints so referenced/referencing columns can change type
    for table, constraint, *_ in FK_CONSTRAINTS:
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint}")

    # 2. Convert PK id columns (drops SERIAL default/sequence first)
    for table in PK_ID_TABLES:
        op.execute(f"ALTER TABLE {table} ALTER COLUMN id DROP DEFAULT")
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN id TYPE UUID USING gen_random_uuid()"
        )
        op.execute(f"ALTER TABLE {table} ALTER COLUMN id SET DEFAULT gen_random_uuid()")
        op.execute(f"DROP SEQUENCE IF EXISTS {table}_id_seq")

    # 3. Convert FK columns (all on empty tables except none — safe blanket conversion)
    for table, column in FK_COLUMNS:
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE UUID USING gen_random_uuid()"
        )

    # 4. Re-add FK constraints against the now-UUID columns
    for table, constraint, column, ref_table, ref_column in FK_CONSTRAINTS:
        op.execute(
            f"ALTER TABLE {table} ADD CONSTRAINT {constraint} "
            f"FOREIGN KEY ({column}) REFERENCES {ref_table} ({ref_column})"
        )


def downgrade() -> None:
    raise NotImplementedError(
        "Downgrade no soportado: UUID -> Integer pierde la correspondencia de ids."
    )
