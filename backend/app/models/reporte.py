import uuid
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.types import GUID


class Reporte(Base):
    __tablename__ = "reportes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    visita_id = Column(GUID(), ForeignKey("visitas.id"), nullable=True)
    tecnico_id = Column(GUID(), ForeignKey("usuarios.id"), nullable=False)
    proyecto_id = Column(GUID(), ForeignKey("proyectos.id"), nullable=False)
    checklist = Column(JSON, default=dict)
    observaciones = Column(Text, default="")
    recomendaciones = Column(Text, default="")
    firma_url = Column(String(500), default="")
    foto_url = Column(String(500), default="")
    fotos = Column(JSON, default=list)
    pdf_path = Column(String(500), default="")
    estado = Column(String(20), default="borrador")
    estado_sync = Column(String(20), default="local")
    progreso = Column(Integer, default=0)  # 0-100
    secciones_completadas = Column(JSON, default=list)  # Lista de IDs de secciones completadas
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    visita = relationship("Visita")
    tecnico = relationship("Usuario")
    proyecto = relationship("Proyecto")
