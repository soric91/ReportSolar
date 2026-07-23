from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://solaradmin:solarpass123@db:5432/solarmaintenance"
    SECRET_KEY: str = "dev-secret-key-change-in-production-12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    REDIS_URL: str = "redis://redis:6379"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:80"
    # Admin - Credenciales iniciales
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
