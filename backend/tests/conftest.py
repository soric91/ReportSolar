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
def test_admin_token(client, setup_db):
    """Obtener token de admin para testing"""
    from app.models.usuario import Usuario, RolEnum, EstadoEnum
    from app.core.security import get_password_hash

    # Crear usuario directamente para el login
    db = TestingSessionLocal()
    try:
        # Check if user already exists
        existing = db.query(Usuario).filter(Usuario.email == "admin@test.com").first()
        if not existing:
            user = Usuario(
                nombre="Test Admin",
                email="admin@test.com",
                hashed_password=get_password_hash("testpass123"),
                rol=RolEnum.administrador,
                estado=EstadoEnum.activo,
            )
            db.add(user)
            db.commit()
        db.close()

        # Login
        response = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "testpass123"},
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    except Exception as e:
        db.close()
        raise


@pytest.fixture()
def auth_headers(test_admin_token):
    """Headers con autenticación"""
    if test_admin_token:
        return {"Authorization": f"Bearer {test_admin_token}"}
    return {}
