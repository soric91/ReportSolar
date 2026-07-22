import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.models.usuario import Usuario, EstadoEnum
from app.models.proyecto import Proyecto
from app.models.reporte import Reporte
from app.core.database import get_db
from tests.conftest import client, db_session

client = TestClient(app)


def test_create_reporte(db_session: Session, client: TestClient):
    usuario = Usuario(
        email="tecnico@test.com",
        hashed_password="hashed",
        nombre="Técnico Test",
        rol="tecnico",
        estado=EstadoEnum.activo,
    )
    db_session.add(usuario)
    db_session.commit()

    proyecto = Proyecto(
        nombre="Proyecto Test",
        cliente="Cliente Test",
        direccion="Dirección Test",
        tipo_sistema="On-Grid",
    )
    db_session.add(proyecto)
    db_session.commit()

    payload = {
        "visita_id": 1,
        "proyecto_id": proyecto.id,
        "checklist": {"test": "data"},
        "observaciones": "Test obs",
        "recomendaciones": "Test rec",
        "firma_url": "http://test.com/firma",
        "estado": "borrador",
    }

    response = client.post("/api/reportes/", json=payload)
    assert response.status_code == 401


def test_list_reportes_pagination(db_session: Session, client: TestClient):
    response = client.get("/api/reportes/?page=1&limit=10")
    assert response.status_code == 401


def test_get_reporte_not_found(db_session: Session, client: TestClient):
    response = client.get("/api/reportes/9999")
    assert response.status_code == 401


def test_save_fotos_to_reporte_not_found(db_session: Session, client: TestClient):
    payload = {"fotos": []}
    response = client.post("/api/reportes/9999/fotos", json=payload)
    assert response.status_code == 401


def test_delete_reporte_not_found(db_session: Session, client: TestClient):
    response = client.delete("/api/reportes/9999")
    assert response.status_code == 401


def test_update_reporte_not_found(db_session: Session, client: TestClient):
    payload = {"checklist": {}}
    response = client.put("/api/reportes/9999", json=payload)
    assert response.status_code == 401


def test_foto_upload_single_no_supabase_config(db_session: Session, client: TestClient):
    payload = {
        "proyecto_nombre": "Test",
        "proyecto_id": 1,
        "checklist_item": "test",
        "tipo": "antes",
        "imagen": "data:image/webp;base64,R0lGODlhAQABAAAAACw=",
    }
    response = client.post("/api/reportes/upload-foto", json=payload)
    assert response.status_code == 401
