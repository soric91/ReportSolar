from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.core.database import get_db
from app.core.config import get_settings
from app.core.security import get_current_user
from app.models.usuario import Usuario
from app.models.reporte import Reporte
from app.schemas.pagination import PaginatedResponse, PaginationParams
from app.services.docx_generator import DocxGenerator
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import httpx
import base64
import time
import logging
import tempfile
import os

router = APIRouter(prefix="/api/reportes", tags=["Reportes"])
logger = logging.getLogger(__name__)


class FotoResponse(BaseModel):
    url: str
    tipo: str
    checklist_item: str
    path: Optional[str] = None


class FotoUploadItem(BaseModel):
    url: str
    checklist_item: str
    tipo: str
    path: Optional[str] = None


class FotoUploadRequest(BaseModel):
    fotos: List[FotoUploadItem]


class ReporteCreateRequest(BaseModel):
    visita_id: Optional[int] = None
    proyecto_id: int
    checklist: dict = {}
    observaciones: str = ""
    recomendaciones: str = ""
    firma_url: str = ""
    estado: str = "borrador"


class ReporteDetailResponse(BaseModel):
    id: int
    visita_id: Optional[int] = None
    tecnico_id: int
    proyecto_id: int
    tecnico_nombre: str = ""
    proyecto_nombre: str = ""
    cliente: str = ""
    checklist: dict = {}
    observaciones: str = ""
    recomendaciones: str = ""
    firma_url: str = ""
    fotos: List[FotoResponse] = []
    pdf_path: str = ""
    estado: str = "borrador"
    estado_sync: str = "local"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


def _build_reporte_response(
    reporte: Reporte, tecnico_nombre: str = "", proyecto_nombre: str = ""
) -> ReporteDetailResponse:
    fotos = reporte.fotos or []
    return ReporteDetailResponse(
        id=reporte.id,
        visita_id=reporte.visita_id,
        tecnico_id=reporte.tecnico_id,
        proyecto_id=reporte.proyecto_id,
        tecnico_nombre=tecnico_nombre or (reporte.tecnico.nombre if reporte.tecnico else ""),
        proyecto_nombre=proyecto_nombre or (reporte.proyecto.nombre if reporte.proyecto else ""),
        cliente=reporte.proyecto.cliente if reporte.proyecto else "",
        checklist=reporte.checklist or {},
        observaciones=reporte.observaciones or "",
        recomendaciones=reporte.recomendaciones or "",
        firma_url=reporte.firma_url or "",
        fotos=fotos,
        pdf_path=reporte.pdf_path or "",
        estado=reporte.estado or "borrador",
        estado_sync=reporte.estado_sync or "local",
        created_at=reporte.created_at,
        updated_at=reporte.updated_at,
    )


@router.post("/{reporte_id}/fotos", status_code=201)
def save_fotos_to_reporte(
    reporte_id: int,
    request: FotoUploadRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reporte = db.query(Reporte).filter(Reporte.id == reporte_id).first()
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    if current_user.rol == "tecnico" and reporte.tecnico_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    existing = reporte.fotos or []
    for foto in request.fotos:
        # Agrega la foto sin reemplazar fotos del mismo tipo
        # Permite múltiples fotos antes/después del mismo campo
        existing.append(
            {
                "url": foto.url,
                "checklist_item": foto.checklist_item,
                "tipo": foto.tipo,
                "path": foto.path,
            }
        )

    reporte.fotos = existing
    db.commit()
    return {"status": "ok", "fotos_count": len(reporte.fotos)}


@router.get("/", response_model=PaginatedResponse[ReporteDetailResponse])
def list_reportes(
    proyecto_id: Optional[int] = None,
    tecnico_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    query = db.query(Reporte).options(
        joinedload(Reporte.tecnico),
        joinedload(Reporte.proyecto),
    )
    if current_user.rol == "tecnico":
        query = query.filter(Reporte.tecnico_id == current_user.id)
    if proyecto_id:
        query = query.filter(Reporte.proyecto_id == proyecto_id)
    if tecnico_id:
        query = query.filter(Reporte.tecnico_id == tecnico_id)

    total = query.count()
    skip = (page - 1) * limit
    reportes = query.order_by(Reporte.created_at.desc()).offset(skip).limit(limit).all()

    result = [_build_reporte_response(r) for r in reportes]
    return PaginatedResponse.create(result, page, limit, total)


@router.get("/{reporte_id}", response_model=ReporteDetailResponse)
def get_reporte(
    reporte_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reporte = (
        db.query(Reporte)
        .options(
            joinedload(Reporte.tecnico),
            joinedload(Reporte.proyecto),
        )
        .filter(Reporte.id == reporte_id)
        .first()
    )
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    if current_user.rol == "tecnico" and reporte.tecnico_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    return _build_reporte_response(reporte)


@router.post("/", response_model=ReporteDetailResponse, status_code=201)
def create_reporte(
    request: ReporteCreateRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    existing_borrador = (
        db.query(Reporte)
        .filter(
            Reporte.proyecto_id == request.proyecto_id,
            Reporte.tecnico_id == current_user.id,
            Reporte.estado == "borrador",
        )
        .first()
    )
    if existing_borrador:
        raise HTTPException(
            status_code=409,
            detail="Ya existe un borrador en proceso. Termina o elimina ese primero.",
        )

    db_reporte = Reporte(
        visita_id=request.visita_id,
        proyecto_id=request.proyecto_id,
        tecnico_id=current_user.id,
        checklist=request.checklist,
        observaciones=request.observaciones,
        recomendaciones=request.recomendaciones,
        firma_url=request.firma_url,
        estado=request.estado,
    )
    db.add(db_reporte)
    db.commit()
    db.refresh(db_reporte)
    return _build_reporte_response(db_reporte, tecnico_nombre=current_user.nombre)


@router.put("/{reporte_id}", response_model=ReporteDetailResponse)
def update_reporte(
    reporte_id: int,
    request: ReporteCreateRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    db_reporte = db.query(Reporte).filter(Reporte.id == reporte_id).first()
    if not db_reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    if current_user.rol == "tecnico" and db_reporte.tecnico_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_reporte, field, value)

    db.commit()
    db.refresh(db_reporte)
    return _build_reporte_response(db_reporte, tecnico_nombre=current_user.nombre)


@router.delete("/{reporte_id}", status_code=204)
def delete_reporte(
    reporte_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    db_reporte = db.query(Reporte).filter(Reporte.id == reporte_id).first()
    if not db_reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    if current_user.rol == "tecnico" and db_reporte.tecnico_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    db.delete(db_reporte)
    db.commit()


class FotoUploadSingleRequest(BaseModel):
    proyecto_nombre: str
    proyecto_id: int
    checklist_item: str
    tipo: str
    imagen: str


@router.post("/upload-foto")
def upload_foto(
    request: FotoUploadSingleRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Supabase no configurado")

    safe_name = "".join(
        c if c.isalnum() or c in "-_" else "_" for c in request.proyecto_nombre
    )[:50]
    import unicodedata

    nfkd = unicodedata.normalize("NFKD", request.checklist_item)
    ascii_item = nfkd.encode("ascii", "ignore").decode("ascii")
    safe_item = ascii_item.replace(".", "-").replace(" ", "_")
    timestamp = int(time.time() * 1000)
    filename = f"{safe_item}_{request.tipo}_{timestamp}.webp"
    folder = f"{safe_name}_{request.proyecto_id}"
    path = f"reportes/{folder}/{filename}"

    imagen_data = request.imagen
    if "," in imagen_data:
        imagen_data = imagen_data.split(",", 1)[1]

    try:
        raw_bytes = base64.b64decode(imagen_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Imagen inválida")

    try:
        resp = httpx.post(
            f"{settings.SUPABASE_URL}/storage/v1/object/app_report/{path}",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "image/webp",
            },
            content=raw_bytes,
            timeout=120,
        )
        if resp.status_code not in (200, 201):
            logger.warning(
                f"Supabase upload failed: status={resp.status_code}, response={resp.text}"
            )
            raise HTTPException(
                status_code=500, detail=f"Error subiendo foto: {resp.text}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Photo upload exception: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"Error subiendo foto: {str(e)}")

    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/app_report/{path}"

    return {
        "url": public_url,
        "path": path,
        "checklist_item": request.checklist_item,
        "tipo": request.tipo,
    }


@router.get("/{reporte_id}/export-docx")
def export_reporte_docx(
    reporte_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reporte = (
        db.query(Reporte)
        .options(
            joinedload(Reporte.tecnico),
            joinedload(Reporte.proyecto),
        )
        .filter(Reporte.id == reporte_id)
        .first()
    )
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    if current_user.rol == "tecnico" and reporte.tecnico_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    proyecto_data = {
        "nombre": reporte.proyecto.nombre if reporte.proyecto else "N/A",
        "cliente": reporte.proyecto.cliente if reporte.proyecto else "",
        "direccion": reporte.proyecto.direccion if reporte.proyecto else "",
        "tipo_sistema": reporte.proyecto.tipo_sistema.value if reporte.proyecto else "",
        "potencia": reporte.checklist.get("datos_proyecto", {}).get("Potencia (kW)", ""),
    }

    reporte_data = {
        "created_at": reporte.created_at,
        "tecnico_nombre": reporte.tecnico.nombre if reporte.tecnico else "",
    }

    # Generar DOCX
    generator = DocxGenerator()
    generator.add_header_with_logo(proyecto_data)
    generator.add_project_info(proyecto_data, reporte_data)

    # Agregar secciones (simplificado - solo datos básicos)
    for section_id, section_data in reporte.checklist.items():
        if section_id != "datos_proyecto" and section_data:
            section_def = {
                "titulo": section_id.replace("_", " ").title(),
                "icono": "📋",
                "campos": [{"nombre": k, "sin_fotos": True} for k in section_data.keys()],
            }
            generator.add_section(section_def, section_data, reporte.fotos or [])

    # Guardar temporalmente
    docx_bytes = generator.generate()
    temp_path = tempfile.NamedTemporaryFile(delete=False, suffix=".docx").name
    with open(temp_path, "wb") as f:
        f.write(docx_bytes)

    filename = f"Informe_{proyecto_data['nombre']}_{datetime.now().strftime('%Y%m%d')}.docx"
    return FileResponse(
        temp_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
