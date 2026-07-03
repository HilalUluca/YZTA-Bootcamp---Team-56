from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Veritabanı engine'i oluştur
# SQLite ve PostgreSQL için farklı ayarlar
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    echo=settings.debug,  # Debug modunda SQL sorgularını konsola yaz
    pool_pre_ping=not settings.database_url.startswith("sqlite"),
    connect_args=connect_args,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Tüm modellerin miras alacağı temel sınıf
class Base(DeclarativeBase):
    pass


def get_db():
    """
    Her API isteğinde yeni bir veritabanı oturumu açar,
    istek bitince otomatik kapatır.
    FastAPI'nin Depends() sistemiyle kullanılır.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
