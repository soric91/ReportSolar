import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class RolEnum(str, enum.Enum):
    administrador = "administrador"
    tecnico = "tecnico"


class EstadoEnum(str, enum.Enum):
    activo = "activo"
    inactivo = "inactivo"


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    rol = Column(Enum(RolEnum), nullable=False, default=RolEnum.tecnico)
    estado = Column(Enum(EstadoEnum), nullable=False, default=EstadoEnum.activo)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    proyectos = relationship(
        "Proyecto", secondary="proyecto_tecnico", back_populates="tecnicos"
    )
