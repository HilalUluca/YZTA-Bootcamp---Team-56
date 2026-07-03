from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Uygulama ayarları. .env dosyasından otomatik okunur."""

    # Veritabanı — .env'de DATABASE_URL yoksa SQLite kullanır (kolay test için)
    # PostgreSQL için: postgresql://postgres:postgres@localhost:5432/focusforge
    database_url: str = "sqlite:///./focusforge.db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT Authentication
    secret_key: str = "focusforge-super-secret-key-degistirmeyi-unutma"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 saat

    # Google Gemini API
    gemini_api_key: str = ""

    # Uygulama
    app_name: str = "FocusForge"
    debug: bool = True

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


@lru_cache()
def get_settings() -> Settings:
    """Ayarları cache'leyerek döndürür. Her seferinde .env okumaz."""
    return Settings()
