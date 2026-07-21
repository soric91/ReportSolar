from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.usuarios import router as usuarios_router
from app.api.proyectos import router as proyectos_router
from app.api.sync import router as sync_router
from app.api.plantillas import router as plantillas_router
from app.api.reportes import router as reportes_router
from app.api.stats import router as stats_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(usuarios_router)
api_router.include_router(proyectos_router)
api_router.include_router(sync_router)
api_router.include_router(plantillas_router)
api_router.include_router(reportes_router)
api_router.include_router(stats_router)
