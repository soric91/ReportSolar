import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.types import GUID


class Visita(Base):
    __tablename__ = "visitas"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    proyecto_id = Column(GUID(), ForeignKey("proyectos.id"), nullable=False)
    tecnico_id = Column(GUID(), ForeignKey("usuarios.id"), nullable=False)
    fecha = Column(DateTime, nullable=False)
    estado = Column(String(20), default="pendiente")
    observaciones_generales = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    proyecto = relationship("Proyecto")
    tecnico = relationship("Usuario")
