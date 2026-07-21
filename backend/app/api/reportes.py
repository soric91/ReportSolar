from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.core.database import get_db
from app.core.config import get_settings
from app.core.security import get_current_user
from app.models.usuario import Usuario
from app.models.reporte import Reporte
from app.schemas.pagination import PaginatedResponse, PaginationParams
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import httpx
import base64
import time

router = APIRouter(prefix="/api/reportes", tags=["Reportes"])


def get_fotos_for_reporte(reporte: Reporte) -> List[dict]:
    return reporte.fotos or []


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


class ReporteDetailResponse(BaseModel):
    id: int
    visita_id: int
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

    result = []
    for r in reportes:
        fotos = get_fotos_for_reporte(r)
        result.append(
            ReporteDetailResponse(
                id=r.id,
                visita_id=r.visita_id,
                tecnico_id=r.tecnico_id,
                proyecto_id=r.proyecto_id,
                tecnico_nombre=r.tecnico.nombre if r.tecnico else "",
                proyecto_nombre=r.proyecto.nombre if r.proyecto else "",
                cliente=r.proyecto.cliente if r.proyecto else "",
                checklist=r.checklist or {},
                observaciones=r.observaciones or "",
                recomendaciones=r.recomendaciones or "",
                firma_url=r.firma_url or "",
                fotos=fotos,
                pdf_path=r.pdf_path or "",
                estado=r.estado or "borrador",
                estado_sync=r.estado_sync or "local",
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
        )
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
    fotos = get_fotos_for_reporte(reporte)
    return ReporteDetailResponse(
        id=reporte.id,
        visita_id=reporte.visita_id,
        tecnico_id=reporte.tecnico_id,
        proyecto_id=reporte.proyecto_id,
        tecnico_nombre=reporte.tecnico.nombre if reporte.tecnico else "",
        proyecto_nombre=reporte.proyecto.nombre if reporte.proyecto else "",
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


@router.post("/", response_model=ReporteDetailResponse, status_code=201)
def create_reporte(
    visita_id: int,
    proyecto_id: int,
    checklist: dict = {},
    observaciones: str = "",
    recomendaciones: str = "",
    firma_url: str = "",
    estado: str = "borrador",
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    db_reporte = Reporte(
        visita_id=visita_id,
        proyecto_id=proyecto_id,
        tecnico_id=current_user.id,
        checklist=checklist,
        observaciones=observaciones,
        recomendaciones=recomendaciones,
        firma_url=firma_url,
        estado=estado,
    )
    db.add(db_reporte)
    db.commit()
    db.refresh(db_reporte)
    return ReporteDetailResponse(
        id=db_reporte.id,
        visita_id=db_reporte.visita_id,
        tecnico_id=db_reporte.tecnico_id,
        proyecto_id=db_reporte.proyecto_id,
        tecnico_nombre=current_user.nombre,
        checklist=checklist,
        observaciones=observaciones,
        recomendaciones=recomendaciones,
        firma_url=firma_url,
        estado=estado,
        created_at=db_reporte.created_at,
    )


@router.put("/{reporte_id}", response_model=ReporteDetailResponse)
def update_reporte(
    reporte_id: int,
    checklist: dict = None,
    observaciones: str = None,
    recomendaciones: str = None,
    firma_url: str = None,
    estado: str = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    db_reporte = db.query(Reporte).filter(Reporte.id == reporte_id).first()
    if not db_reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    if current_user.rol == "tecnico" and db_reporte.tecnico_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    if checklist is not None:
        db_reporte.checklist = checklist
    if observaciones is not None:
        db_reporte.observaciones = observaciones
    if recomendaciones is not None:
        db_reporte.recomendaciones = recomendaciones
    if firma_url is not None:
        db_reporte.firma_url = firma_url
    if estado is not None:
        db_reporte.estado = estado

    db.commit()
    db.refresh(db_reporte)
    return ReporteDetailResponse(
        id=db_reporte.id,
        visita_id=db_reporte.visita_id,
        tecnico_id=db_reporte.tecnico_id,
        proyecto_id=db_reporte.proyecto_id,
        tecnico_nombre=current_user.nombre,
        checklist=db_reporte.checklist or {},
        observaciones=db_reporte.observaciones or "",
        recomendaciones=db_reporte.recomendaciones or "",
        firma_url=db_reporte.firma_url or "",
        estado=db_reporte.estado or "borrador",
        estado_sync=db_reporte.estado_sync or "local",
        created_at=db_reporte.created_at,
        updated_at=db_reporte.updated_at,
    )


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
            print(f"[UPLOAD ERROR] Supabase respondió {resp.status_code}: {resp.text}")
            raise HTTPException(
                status_code=500, detail=f"Error subiendo foto: {resp.text}"
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[UPLOAD ERROR] Excepción: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Error subiendo foto: {str(e)}")

    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/app_report/{path}"

    return {
        "url": public_url,
        "path": path,
        "checklist_item": request.checklist_item,
        "tipo": request.tipo,
    }
