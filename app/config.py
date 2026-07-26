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
    port: int = 8000
    frontend_url: str = ""  # Production: Vercel URL

    # Koç Uyarı Eşikleri
    warning_negative_sentiment_ratio: float = 0.4
    warning_energy_drop: float = 1.0
    critical_mood_avg: float = 2.5
    critical_energy_avg: float = 2.5
    
    # AI Hafıza Ayarları
    memory_strategy: str = "summary_buffer" # "last_n" veya "summary_buffer"
    recent_window_size: int = 4
    summary_update_interval: int = 6

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


@lru_cache()
def get_settings() -> Settings:
    """Ayarları cache'leyerek döndürür. Her seferinde .env okumaz."""
    return Settings()
