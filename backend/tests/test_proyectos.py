import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.models.usuario import Usuario, EstadoEnum
from app.models.proyecto import Proyecto
from app.core.database import get_db
from tests.conftest import client, db_session

client = TestClient(app)


def test_list_proyectos_empty(db_session: Session, client: TestClient):
    response = client.get("/api/proyectos/")
    assert response.status_code == 401


def test_create_proyecto_requires_admin(db_session: Session, client: TestClient):
    payload = {
        "nombre": "Nuevo Proyecto",
        "cliente": "Cliente",
        "direccion": "Dirección",
        "tipo_sistema": "On-Grid",
        "componentes": {},
        "tecnicos_ids": [],
    }
    response = client.post("/api/proyectos/", json=payload)
    assert response.status_code == 401


def test_get_proyecto_not_found(db_session: Session, client: TestClient):
    response = client.get("/api/proyectos/9999")
    assert response.status_code == 401


def test_update_proyecto_not_found(db_session: Session, client: TestClient):
    payload = {"nombre": "Updated"}
    response = client.put("/api/proyectos/9999", json=payload)
    assert response.status_code == 401


def test_delete_proyecto_not_found(db_session: Session, client: TestClient):
    response = client.delete("/api/proyectos/9999")
    assert response.status_code == 401


def test_asignar_tecnico_not_found(db_session: Session, client: TestClient):
    response = client.post("/api/proyectos/9999/asignar-tecnico?tecnico_id=1")
    assert response.status_code == 401


def test_desasignar_tecnico_not_found(db_session: Session, client: TestClient):
    response = client.delete("/api/proyectos/9999/desasignar-tecnico/1")
    assert response.status_code == 401
