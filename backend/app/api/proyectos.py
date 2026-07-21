from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.usuario import Usuario, EstadoEnum
from app.models.proyecto import Proyecto
from app.schemas.pagination import PaginatedResponse
from app.schemas.proyecto import (
    ProyectoCreate,
    ProyectoUpdate,
    ProyectoResponse,
)

router = APIRouter(prefix="/api/proyectos", tags=["Proyectos"])


@router.get("/", response_model=PaginatedResponse[ProyectoResponse])
def list_proyectos(
    cliente: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    query = db.query(Proyecto).options(
        joinedload(Proyecto.tecnicos), joinedload(Proyecto.plantilla)
    )

    if current_user.rol == "tecnico":
        query = query.filter(Proyecto.tecnicos.any(Usuario.id == current_user.id))
    elif cliente:
        query = query.filter(Proyecto.cliente.ilike(f"%{cliente}%"))

    total = query.count()
    skip = (page - 1) * limit
    results = query.offset(skip).limit(limit).all()
    for r in results:
        r.plantilla_nombre = r.plantilla.nombre if r.plantilla else None

    return PaginatedResponse.create(results, page, limit, total)


@router.get("/{proyecto_id}", response_model=ProyectoResponse)
def get_proyecto(
    proyecto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    proyecto = (
        db.query(Proyecto)
        .options(joinedload(Proyecto.tecnicos), joinedload(Proyecto.plantilla))
        .filter(Proyecto.id == proyecto_id)
        .first()
    )
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if current_user.rol == "tecnico":
        if not any(t.id == current_user.id for t in proyecto.tecnicos):
            raise HTTPException(
                status_code=403, detail="No tienes acceso a este proyecto"
            )

    proyecto.plantilla_nombre = (
        proyecto.plantilla.nombre if proyecto.plantilla else None
    )
    return proyecto


@router.post("/", response_model=ProyectoResponse, status_code=201)
def create_proyecto(
    proyecto: ProyectoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_proyecto = Proyecto(
        nombre=proyecto.nombre,
        cliente=proyecto.cliente,
        direccion=proyecto.direccion,
        tipo_sistema=proyecto.tipo_sistema,
        componentes=proyecto.componentes or {},
        plantilla_id=proyecto.plantilla_id,
    )

    if proyecto.tecnicos_ids:
        tecnicos = (
            db.query(Usuario)
            .filter(
                Usuario.id.in_(proyecto.tecnicos_ids),
                Usuario.rol == "tecnico",
                Usuario.estado == EstadoEnum.activo,
            )
            .all()
        )
        db_proyecto.tecnicos = tecnicos

    db.add(db_proyecto)
    db.commit()
    db.refresh(db_proyecto)

    db_proyecto.plantilla_nombre = (
        db_proyecto.plantilla.nombre if db_proyecto.plantilla else None
    )
    return db_proyecto


@router.put("/{proyecto_id}", response_model=ProyectoResponse)
def update_proyecto(
    proyecto_id: int,
    proyecto: ProyectoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id).first()
    if not db_proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    update_data = proyecto.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_proyecto, field, value)

    db.commit()
    db.refresh(db_proyecto)

    db_proyecto.plantilla_nombre = (
        db_proyecto.plantilla.nombre if db_proyecto.plantilla else None
    )
    return db_proyecto


@router.delete("/{proyecto_id}", status_code=204)
def delete_proyecto(
    proyecto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id).first()
    if not db_proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    db.delete(db_proyecto)
    db.commit()


@router.post("/{proyecto_id}/asignar-tecnico", response_model=ProyectoResponse)
def asignar_tecnico(
    proyecto_id: int,
    tecnico_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id).first()
    if not db_proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    tecnico = (
        db.query(Usuario)
        .filter(
            Usuario.id == tecnico_id,
            Usuario.rol == "tecnico",
            Usuario.estado == "activo",
        )
        .first()
    )
    if not tecnico:
        raise HTTPException(status_code=404, detail="Técnico no encontrado")

    if tecnico in db_proyecto.tecnicos:
        raise HTTPException(status_code=400, detail="Técnico ya asignado")

    db_proyecto.tecnicos.append(tecnico)
    db.commit()
    db.refresh(db_proyecto)
    return db_proyecto


@router.delete(
    "/{proyecto_id}/desasignar-tecnico/{tecnico_id}", response_model=ProyectoResponse
)
def desasignar_tecnico(
    proyecto_id: int,
    tecnico_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id).first()
    if not db_proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    tecnico = db.query(Usuario).filter(Usuario.id == tecnico_id).first()
    if not tecnico or tecnico not in db_proyecto.tecnicos:
        raise HTTPException(
            status_code=404, detail="Técnico no asignado a este proyecto"
        )

    db_proyecto.tecnicos.remove(tecnico)
    db.commit()
    db.refresh(db_proyecto)
    return db_proyecto
