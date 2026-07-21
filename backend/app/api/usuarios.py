from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_role, get_password_hash
from app.core.config import get_settings
from app.models.usuario import Usuario, RolEnum
from app.schemas.pagination import PaginatedResponse
from app.schemas.usuario import (
    UsuarioCreate,
    UsuarioUpdate,
    UsuarioResponse,
    PasswordReset,
)
import httpx
import uuid

router = APIRouter(prefix="/api/usuarios", tags=["Usuarios"])


def sync_user_to_supabase(nombre: str, email: str, rol: str):
    import logging

    logger = logging.getLogger(__name__)

    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        logger.warning("Supabase credentials not configured, skipping sync")
        return
    try:
        resp = httpx.post(
            f"{settings.SUPABASE_URL}/rest/v1/users",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "auth_id": str(uuid.uuid4()),
                "name": nombre,
                "email": email,
                "role": rol,
            },
            timeout=10,
        )
        logger.info(f"Supabase sync response: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"Supabase sync failed: {e}")

    try:
        auth_resp = httpx.post(
            f"{settings.SUPABASE_URL}/auth/v1/admin/users",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"name": nombre, "role": rol},
            },
            timeout=15,
        )

        if auth_resp.status_code not in (200, 422):
            logger.error(
                f"Supabase Auth create failed: {auth_resp.status_code} {auth_resp.text}"
            )
            return None

        if auth_resp.status_code == 422 and "already been registered" in auth_resp.text:
            logger.warning(f"User {email} already exists in Supabase Auth")
            auth_data = httpx.get(
                f"{settings.SUPABASE_URL}/auth/v1/admin/users",
                headers={
                    "apikey": settings.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                },
                params={"email": email},
                timeout=15,
            )
            if auth_data.status_code == 200:
                users = auth_data.json().get("users", [])
                if users:
                    return users[0]["id"]
            return None

        auth_user = auth_resp.json()
        auth_id = auth_user.get("id")

        if auth_id:
            table_resp = httpx.post(
                f"{settings.SUPABASE_URL}/rest/v1/users",
                headers={
                    "apikey": settings.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json={
                    "auth_id": auth_id,
                    "name": nombre,
                    "email": email,
                    "role": rol,
                },
                timeout=10,
            )
            logger.info(f"Supabase table sync: {table_resp.status_code}")

        return auth_id

    except Exception as e:
        logger.error(f"Supabase sync failed: {e}")
        return None


@router.get("/", response_model=PaginatedResponse[UsuarioResponse])
def list_usuarios(
    rol: Optional[RolEnum] = None,
    estado: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    query = db.query(Usuario)
    if rol:
        query = query.filter(Usuario.rol == rol)
    if estado:
        query = query.filter(Usuario.estado == estado)

    total = query.count()
    skip = (page - 1) * limit
    usuarios = query.offset(skip).limit(limit).all()

    return PaginatedResponse.create(usuarios, page, limit, total)


@router.get("/{usuario_id}", response_model=UsuarioResponse)
def get_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.post("/", response_model=UsuarioResponse, status_code=201)
def create_usuario(
    usuario: UsuarioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    existing = db.query(Usuario).filter(Usuario.email == usuario.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    db_user = Usuario(
        nombre=usuario.nombre,
        email=usuario.email,
        hashed_password=get_password_hash(usuario.password),
        rol=usuario.rol,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    sync_user_to_supabase(usuario.nombre, usuario.email, usuario.rol)

    return db_user


@router.put("/{usuario_id}", response_model=UsuarioResponse)
def update_usuario(
    usuario_id: int,
    usuario: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    update_data = usuario.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)
    return db_user


@router.patch("/{usuario_id}/desactivar", response_model=UsuarioResponse)
def desactivar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo")

    db_user.estado = "inactivo"
    db.commit()
    db.refresh(db_user)
    return db_user


@router.delete("/{usuario_id}", status_code=204)
def delete_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    db.execute(
        text("UPDATE visitas SET tecnico_id = NULL WHERE tecnico_id = :uid"),
        {"uid": usuario_id},
    )
    db.execute(
        text("UPDATE reportes SET tecnico_id = NULL WHERE tecnico_id = :uid"),
        {"uid": usuario_id},
    )
    db.execute(
        text("DELETE FROM proyecto_tecnico WHERE tecnico_id = :uid"),
        {"uid": usuario_id},
    )

    db.delete(db_user)
    db.commit()


@router.patch("/{usuario_id}/reset-password", response_model=UsuarioResponse)
def reset_password(
    usuario_id: int,
    data: PasswordReset,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    db_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    db.refresh(db_user)
    return db_user
