from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class PlantillaInforme(Base):
    __tablename__ = "plantillas_informe"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text, default="")
    encabezado = Column(JSON, default=dict)
    secciones = Column(JSON, default=list)
    pie_pagina = Column(JSON, default=dict)
    colores = Column(JSON, default=dict)
    logo_url = Column(String(500), default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    proyectos = relationship("Proyecto", back_populates="plantilla")
