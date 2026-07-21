"""Script para crear el usuario administrador inicial."""

import sys
import os
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.usuario import Usuario, RolEnum


def create_admin():
    db = SessionLocal()
    try:
        # Lee credenciales de variables de entorno
        admin_email = os.getenv("ADMIN_EMAIL", "admin@solar.com")
        admin_password = os.getenv("ADMIN_PASSWORD")
        admin_name = os.getenv("ADMIN_NAME", "Administrador")

        if not admin_password:
            print("❌ Error: ADMIN_PASSWORD no está definido en .env")
            print("Define ADMIN_PASSWORD en tu archivo .env y vuelve a ejecutar")
            return

        existing = db.query(Usuario).filter(Usuario.email == admin_email).first()
        if existing:
            print(f"✅ Admin ya existe: {admin_email}")
            return

        admin = Usuario(
            nombre=admin_name,
            email=admin_email,
            hashed_password=get_password_hash(admin_password),
            rol=RolEnum.administrador,
            estado="activo",
        )
        db.add(admin)
        db.commit()
        print(f"✅ Admin creado: {admin_email}")
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
