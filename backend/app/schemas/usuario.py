from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.models.usuario import RolEnum, EstadoEnum
from app.schemas.validators import (
    EmailValidator,
    NombreValidator,
    PasswordValidator,
)


class UsuarioBase(BaseModel):
    nombre: str
    email: str
    rol: RolEnum = RolEnum.tecnico

    @field_validator('nombre')
    @classmethod
    def validate_nombre(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError('Nombre debe tener al menos 2 caracteres')
        if len(v) > 100:
            raise ValueError('Nombre no puede exceder 100 caracteres')
        return v

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if len(v) > 150:
            raise ValueError('Email no puede exceder 150 caracteres')
        return v.lower()


class UsuarioCreate(UsuarioBase):
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Contraseña debe tener al menos 6 caracteres')
        if len(v) > 100:
            raise ValueError('Contraseña no puede exceder 100 caracteres')
        return v


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    rol: Optional[RolEnum] = None

    @field_validator('nombre')
    @classmethod
    def validate_nombre(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) < 2:
            raise ValueError('Nombre debe tener al menos 2 caracteres')
        if len(v) > 100:
            raise ValueError('Nombre no puede exceder 100 caracteres')
        return v

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if v is None:
            return v
        if len(v) > 150:
            raise ValueError('Email no puede exceder 150 caracteres')
        return v.lower()


class UsuarioResponse(UsuarioBase):
    id: UUID
    estado: EstadoEnum
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if not v or len(v) > 150:
            raise ValueError('Email inválido')
        return v.lower()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not v or len(v) < 1:
            raise ValueError('Contraseña requerida')
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PasswordReset(BaseModel):
    new_password: str
