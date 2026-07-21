from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime


class PlantillaEncabezado(BaseModel):
    titulo: str = "Informe de Mantenimiento"
    subtitulo: str = ""
    empresa: str = ""
    logo_url: str = ""


class PlantillaSeccion(BaseModel):
    id: str
    titulo: str
    icono: str = "📋"
    campos: List[Dict] = []


class PlantillaColores(BaseModel):
    primario: str = "#0284c7"
    secundario: str = "#f0f9ff"
    texto: str = "#1f2937"
    fondo: str = "#ffffff"


class PlantillaBase(BaseModel):
    nombre: str
    descripcion: str = ""
    encabezado: Optional[Dict] = {}
    secciones: Optional[List[Dict]] = []
    pie_pagina: Optional[Dict] = {}
    colores: Optional[Dict] = {}
    logo_url: str = ""


class PlantillaCreate(PlantillaBase):
    pass


class PlantillaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    encabezado: Optional[Dict] = None
    secciones: Optional[List[Dict]] = None
    pie_pagina: Optional[Dict] = None
    colores: Optional[Dict] = None
    logo_url: Optional[str] = None


class PlantillaResponse(PlantillaBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
