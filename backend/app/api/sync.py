from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.usuario import Usuario
from app.models.proyecto import Proyecto
from app.models.visita import Visita
from app.models.reporte import Reporte

router = APIRouter(prefix="/api/sync", tags=["Sincronización"])


class ProyectoSync(BaseModel):
    id: int
    nombre: str
    cliente: str
    direccion: str
    tipo_sistema: str
    componentes: dict
    plantilla: dict | None = None

    class Config:
        from_attributes = True


class SyncResponse(BaseModel):
    proyectos: List[ProyectoSync]


@router.get("/proyectos", response_model=SyncResponse)
def sync_proyectos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    proyectos = (
        db.query(Proyecto)
        .filter(Proyecto.tecnicos.any(Usuario.id == current_user.id))
        .options(joinedload(Proyecto.tecnicos), joinedload(Proyecto.plantilla))
        .all()
    )

    # Ensure each proyecto has exactly one active borrador
    for p in proyectos:
        existing_borrador = (
            db.query(Reporte)
            .filter(
                Reporte.proyecto_id == p.id,
                Reporte.tecnico_id == current_user.id,
                Reporte.estado == "borrador",
            )
            .first()
        )
        if not existing_borrador:
            new_reporte = Reporte(
                proyecto_id=p.id,
                tecnico_id=current_user.id,
                visita_id=None,
                estado="borrador",
                checklist={},
            )
            db.add(new_reporte)
    db.commit()

    return SyncResponse(
        proyectos=[
            ProyectoSync(
                id=p.id,
                nombre=p.nombre,
                cliente=p.cliente,
                direccion=p.direccion,
                tipo_sistema=p.tipo_sistema.value,
                componentes=p.componentes or {},
                plantilla={
                    "id": p.plantilla.id,
                    "nombre": p.plantilla.nombre,
                    "secciones": p.plantilla.secciones,
                    "colores": p.plantilla.colores,
                    "encabezado": p.plantilla.encabezado,
                    "logo_url": p.plantilla.logo_url,
                }
                if p.plantilla
                else None,
            )
            for p in proyectos
        ],
    )


class VisitaSyncItem(BaseModel):
    local_id: Optional[int] = None
    reporte_id: Optional[int] = None
    proyecto_id: int
    fecha: Optional[str] = None
    estado: str = "finalizada"
    checklist: dict = {}
    observaciones: str = ""
    recomendaciones: str = ""
    firma_dato: Optional[str] = None
    reporte_estado: Optional[str] = "borrador"
    fotos: Optional[List[dict]] = []
    progreso: Optional[int] = 0
    secciones_completadas: Optional[List[str]] = []


class SyncBatchRequest(BaseModel):
    visitas: List[VisitaSyncItem]


class SyncDetail(BaseModel):
    local_id: Optional[int] = None
    server_id: Optional[int] = None
    reporte_id: Optional[int] = None
    status: str
    error: Optional[str] = None


class SyncBatchResponse(BaseModel):
    sincronizados: int
    conflictos: int
    detalles: List[SyncDetail]


@router.post("/batch", response_model=SyncBatchResponse)
def sync_batch(
    request: SyncBatchRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    detalles = []
    sincronizados = 0
    conflictos = 0

    for item in request.visitas:
        try:
            proyecto = (
                db.query(Proyecto).filter(Proyecto.id == item.proyecto_id).first()
            )
            if not proyecto:
                detalles.append(
                    SyncDetail(
                        local_id=item.local_id,
                        status="error",
                        error="Proyecto no encontrado",
                    )
                )
                conflictos += 1
                continue

            fecha_dt = (
                datetime.fromisoformat(item.fecha.replace("Z", "+00:00"))
                if item.fecha
                else datetime.utcnow()
            )

            reporte_estado = item.reporte_estado or (
                "completado" if item.estado == "finalizada" else "borrador"
            )

            reporte = None
            if item.reporte_id:
                reporte = (
                    db.query(Reporte).filter(Reporte.id == item.reporte_id).first()
                )

            if not reporte and reporte_estado == "borrador":
                reporte = (
                    db.query(Reporte)
                    .filter(
                        Reporte.proyecto_id == item.proyecto_id,
                        Reporte.tecnico_id == current_user.id,
                        Reporte.estado == "borrador",
                    )
                    .order_by(Reporte.created_at.desc())
                    .first()
                )

            if reporte:
                reporte.checklist = item.checklist or {}
                reporte.observaciones = item.observaciones or ""
                reporte.recomendaciones = item.recomendaciones or ""
                reporte.firma_url = item.firma_dato or ""
                reporte.estado = reporte_estado
                reporte.estado_sync = "sincronizado"
                reporte.fotos = item.fotos or []
                reporte.progreso = item.progreso or 0
                reporte.secciones_completadas = item.secciones_completadas or []
                reporte.updated_at = datetime.utcnow()
                db.flush()

                detalles.append(
                    SyncDetail(
                        local_id=item.local_id,
                        server_id=reporte.visita_id,
                        reporte_id=reporte.id,
                        status="ok",
                    )
                )
            else:
                visita = Visita(
                    proyecto_id=item.proyecto_id,
                    tecnico_id=current_user.id,
                    fecha=fecha_dt,
                    estado=item.estado,
                    observaciones_generales=item.observaciones or "",
                )
                db.add(visita)
                db.flush()

                reporte = Reporte(
                    visita_id=visita.id,
                    tecnico_id=current_user.id,
                    proyecto_id=item.proyecto_id,
                    checklist=item.checklist or {},
                    observaciones=item.observaciones or "",
                    recomendaciones=item.recomendaciones or "",
                    firma_url=item.firma_dato or "",
                    estado=reporte_estado,
                    estado_sync="sincronizado",
                    fotos=item.fotos or [],
                    progreso=item.progreso or 0,
                    secciones_completadas=item.secciones_completadas or [],
                )
                db.add(reporte)
                db.flush()

                detalles.append(
                    SyncDetail(
                        local_id=item.local_id,
                        server_id=visita.id,
                        reporte_id=reporte.id,
                        status="ok",
                    )
                )

            sincronizados += 1

        except Exception as e:
            detalles.append(
                SyncDetail(
                    local_id=item.local_id,
                    status="error",
                    error=str(e),
                )
            )
            conflictos += 1

    db.commit()

    return SyncBatchResponse(
        sincronizados=sincronizados,
        conflictos=conflictos,
        detalles=detalles,
    )
