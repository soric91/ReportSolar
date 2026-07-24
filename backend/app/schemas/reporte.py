from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime
from uuid import UUID


class ReporteBase(BaseModel):
    checklist: Optional[Dict] = {}
    observaciones: str = ""
    recomendaciones: str = ""
    firma_url: str = ""
    estado: str = "borrador"
    progreso: Optional[int] = 0
    secciones_completadas: Optional[List[str]] = []


class ReporteCreate(ReporteBase):
    visita_id: UUID
    proyecto_id: UUID


class ReporteUpdate(BaseModel):
    checklist: Optional[Dict] = None
    observaciones: Optional[str] = None
    recomendaciones: Optional[str] = None
    firma_url: Optional[str] = None
    estado: Optional[str] = None
    progreso: Optional[int] = None
    secciones_completadas: Optional[List[str]] = None


class ReporteResponse(ReporteBase):
    id: UUID
    visita_id: UUID
    tecnico_id: UUID
    proyecto_id: UUID
    pdf_path: str = ""
    estado: str = "borrador"
    estado_sync: str = "local"
    progreso: int = 0
    secciones_completadas: List[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
