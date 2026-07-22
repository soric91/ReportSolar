import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.models.usuario import Usuario, EstadoEnum
from app.models.proyecto import Proyecto
from app.core.database import get_db
from tests.conftest import client, db_session

client = TestClient(app)


def test_sync_proyectos_requires_auth(client: TestClient):
    response = client.get("/api/sync/proyectos")
    assert response.status_code == 401


def test_sync_batch_requires_auth(client: TestClient):
    payload = {"visitas": []}
    response = client.post("/api/sync/batch", json=payload)
    assert response.status_code == 401


def test_sync_batch_empty(db_session: Session, client: TestClient):
    payload = {"visitas": []}
    response = client.post("/api/sync/batch", json=payload)
    assert response.status_code == 401


def test_sync_batch_proyecto_not_found(db_session: Session, client: TestClient):
    payload = {
        "visitas": [
            {
                "local_id": 1,
                "proyecto_id": 9999,
                "estado": "finalizada",
                "checklist": {},
            }
        ]
    }
    response = client.post("/api/sync/batch", json=payload)
    assert response.status_code == 401
