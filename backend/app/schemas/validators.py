from pydantic import BaseModel, field_validator, EmailStr
from typing import Optional
import re

class EmailValidator(BaseModel):
    email: EmailStr

    @field_validator('email')
    @classmethod
    def email_must_be_valid(cls, v):
        if len(v) > 150:
            raise ValueError('Email no puede exceder 150 caracteres')
        return v.lower()


class NombreValidator(BaseModel):
    nombre: str

    @field_validator('nombre')
    @classmethod
    def nombre_must_be_valid(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError('Nombre debe tener al menos 2 caracteres')
        if len(v) > 100:
            raise ValueError('Nombre no puede exceder 100 caracteres')
        # Solo permite letras, números, espacios y guiones
        if not re.match(r'^[a-zA-ZáéíóúñÁÉÍÓÚÑ0-9\s\-]+$', v):
            raise ValueError('Nombre contiene caracteres no permitidos')
        return v


class PasswordValidator(BaseModel):
    password: str

    @field_validator('password')
    @classmethod
    def password_must_be_strong(cls, v):
        if len(v) < 6:
            raise ValueError('Contraseña debe tener al menos 6 caracteres')
        if len(v) > 100:
            raise ValueError('Contraseña no puede exceder 100 caracteres')
        # Validar complejidad (opcional, comentado para flexibilidad)
        # if not re.search(r'[A-Z]', v):
        #     raise ValueError('Contraseña debe contener mayúscula')
        # if not re.search(r'[0-9]', v):
        #     raise ValueError('Contraseña debe contener número')
        return v


class DireccionValidator(BaseModel):
    direccion: str

    @field_validator('direccion')
    @classmethod
    def direccion_must_be_valid(cls, v):
        v = v.strip()
        if len(v) < 5:
            raise ValueError('Dirección debe tener al menos 5 caracteres')
        if len(v) > 255:
            raise ValueError('Dirección no puede exceder 255 caracteres')
        return v


class URLValidator(BaseModel):
    url: str

    @field_validator('url')
    @classmethod
    def url_must_be_valid(cls, v):
        # Patrón simple de URL
        pattern = r'^https?://[^\s/$.?#].[^\s]*$'
        if not re.match(pattern, v, re.IGNORECASE):
            raise ValueError('URL inválida')
        if len(v) > 2048:
            raise ValueError('URL no puede exceder 2048 caracteres')
        return v


class JSONValidator(BaseModel):
    data: dict

    @field_validator('data')
    @classmethod
    def json_must_be_valid(cls, v):
        if not isinstance(v, dict):
            raise ValueError('Datos deben ser un objeto JSON válido')
        return v


# Composición de validadores
class UsuarioBaseValidator(NombreValidator, EmailValidator, PasswordValidator):
    """Combina validadores para usuario"""
    pass


# Validadores específicos de dominio
class ProyectoNombreValidator(BaseModel):
    nombre: str

    @field_validator('nombre')
    @classmethod
    def nombre_proyecto(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError('Nombre de proyecto debe tener al menos 3 caracteres')
        if len(v) > 200:
            raise ValueError('Nombre de proyecto no puede exceder 200 caracteres')
        return v


class ClienteNombreValidator(BaseModel):
    cliente: str

    @field_validator('cliente')
    @classmethod
    def cliente_nombre(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError('Nombre de cliente debe tener al menos 2 caracteres')
        if len(v) > 150:
            raise ValueError('Nombre de cliente no puede exceder 150 caracteres')
        return v


class TipoSistemaValidator(BaseModel):
    tipo_sistema: str

    @field_validator('tipo_sistema')
    @classmethod
    def tipo_sistema_valido(cls, v):
        tipos_validos = ['on_grid', 'off_grid', 'hibrido']
        if v not in tipos_validos:
            raise ValueError(f'Tipo de sistema debe ser uno de: {", ".join(tipos_validos)}')
        return v


class ObservacionesValidator(BaseModel):
    observaciones: Optional[str] = None

    @field_validator('observaciones')
    @classmethod
    def observaciones_validar(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) > 2000:
            raise ValueError('Observaciones no pueden exceder 2000 caracteres')
        return v if v else None
