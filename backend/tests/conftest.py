import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, get_db

# Import models to register them with Base
from app.models.usuario import Usuario
from app.models.proyecto import Proyecto
from app.models.plantilla import PlantillaInforme
from app.models.reporte import Reporte
from app.models.visita import Visita

# Test database URL (in-memory SQLite)
TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    return TestingSessionLocal()


@pytest.fixture()
def db_session():
    """Alias para db para compatibilidad con tests existentes"""
    return TestingSessionLocal()


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def test_usuario(db):
    """Crear usuario de prueba"""
    from app.models.usuario import Usuario, RolEnum, EstadoEnum
    from app.core.security import get_password_hash

    user = Usuario(
        nombre="Test User",
        email="test@example.com",
        hashed_password=get_password_hash("testpass123"),
        rol=RolEnum.administrador,
        estado=EstadoEnum.activo,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def test_admin_token(client, test_usuario):
    """Obtener token de admin para testing"""
    response = client.post(
        "/api/auth/login",
        json={"email": test_usuario.email, "password": "testpass123"},
    )
    return response.json()["access_token"]


@pytest.fixture()
def auth_headers(test_admin_token):
    """Headers con autenticación"""
    return {"Authorization": f"Bearer {test_admin_token}"}
