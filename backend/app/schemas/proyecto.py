from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime
from uuid import UUID
from app.models.proyecto import TipoSistemaEnum


class ProyectoBase(BaseModel):
    nombre: str
    cliente: str
    direccion: str
    tipo_sistema: TipoSistemaEnum = TipoSistemaEnum.on_grid
    componentes: Optional[Dict] = {}


class ProyectoCreate(ProyectoBase):
    tecnicos_ids: Optional[List[UUID]] = []
    plantilla_id: Optional[UUID] = None


class ProyectoUpdate(BaseModel):
    nombre: Optional[str] = None
    cliente: Optional[str] = None
    direccion: Optional[str] = None
    tipo_sistema: Optional[TipoSistemaEnum] = None
    componentes: Optional[Dict] = None
    plantilla_id: Optional[UUID] = None


class TecnicoAsignado(BaseModel):
    id: UUID
    nombre: str
    email: str

    class Config:
        from_attributes = True


class ProyectoResponse(ProyectoBase):
    id: UUID
    tecnicos: List[TecnicoAsignado] = []
    plantilla_id: Optional[UUID] = None
    plantilla_nombre: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
