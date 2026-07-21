import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, JSON, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class TipoSistemaEnum(str, enum.Enum):
    on_grid = "on_grid"
    off_grid = "off_grid"
    hibrido = "hibrido"


proyecto_tecnico = Table(
    "proyecto_tecnico",
    Base.metadata,
    Column("proyecto_id", Integer, ForeignKey("proyectos.id"), primary_key=True),
    Column("tecnico_id", Integer, ForeignKey("usuarios.id"), primary_key=True),
)


class Proyecto(Base):
    __tablename__ = "proyectos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    cliente = Column(String(200), nullable=False)
    direccion = Column(String(300), nullable=False)
    tipo_sistema = Column(
        Enum(TipoSistemaEnum), nullable=False, default=TipoSistemaEnum.on_grid
    )
    componentes = Column(JSON, default=dict)
    plantilla_id = Column(Integer, ForeignKey("plantillas_informe.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tecnicos = relationship(
        "Usuario", secondary=proyecto_tecnico, back_populates="proyectos"
    )
    plantilla = relationship("PlantillaInforme", back_populates="proyectos")
