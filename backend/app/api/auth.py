from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    require_role,
    oauth2_scheme,
)
from app.core.token_blacklist import blacklist_token
from app.models.usuario import Usuario
from app.schemas.usuario import (
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    UsuarioResponse,
)
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if user.estado != "activo":
        raise HTTPException(status_code=403, detail="Usuario desactivado")

    access_token = create_access_token(data={"sub": user.id, "rol": user.rol.value})
    refresh_token = create_refresh_token(data={"sub": user.id})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    payload = decode_token(request.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = int(payload.get("sub"))
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user or user.estado != "activo":
        raise HTTPException(status_code=401, detail="User not found or inactive")

    access_token = create_access_token(data={"sub": user.id, "rol": user.rol.value})
    refresh_token = create_refresh_token(data={"sub": user.id})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UsuarioResponse)
def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user


class LogoutRequest(BaseModel):
    access_token: str


@router.post("/logout")
def logout(request: LogoutRequest, current_user: Usuario = Depends(get_current_user)):
    blacklist_token(request.access_token)
    return {"message": "Successfully logged out"}
