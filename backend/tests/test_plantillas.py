import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.models.plantilla import PlantillaInforme
from app.core.database import get_db
from tests.conftest import client, db_session

client = TestClient(app)


def test_get_default_secciones(client: TestClient):
    response = client.get("/api/plantillas/default-secciones")
    assert response.status_code == 401


def test_list_plantillas_requires_admin(db_session: Session, client: TestClient):
    response = client.get("/api/plantillas/")
    assert response.status_code == 401


def test_create_plantilla_requires_admin(db_session: Session, client: TestClient):
    payload = {"nombre": "Nueva Plantilla", "secciones": []}
    response = client.post("/api/plantillas/", json=payload)
    assert response.status_code == 401


def test_get_plantilla_requires_admin(db_session: Session, client: TestClient):
    response = client.get("/api/plantillas/1")
    assert response.status_code == 401


def test_update_plantilla_requires_admin(db_session: Session, client: TestClient):
    payload = {"nombre": "Updated"}
    response = client.put("/api/plantillas/1", json=payload)
    assert response.status_code == 401


def test_delete_plantilla_requires_admin(db_session: Session, client: TestClient):
    response = client.delete("/api/plantillas/1")
    assert response.status_code == 401


def test_plantilla_uses_default_secciones_on_create(
    db_session: Session, client: TestClient
):
    plantilla = PlantillaInforme(
        nombre="Test",
        secciones=None,
    )
    db_session.add(plantilla)
    db_session.commit()

    assert plantilla.secciones is None
