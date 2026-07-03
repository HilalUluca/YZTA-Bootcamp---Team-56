"""
FocusForge Backend — Ana Uygulama

AI Destekli Kişisel Verimlilik & Odaklanma Asistanı

Çalıştırmak için:
    uvicorn app.main:app --reload

Swagger API dokümantasyonu:
    http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base
from app.routers import auth_router, tasks_router, chat_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Uygulama başlarken veritabanı tablolarını oluştur.
    Not: Production'da Alembic migration kullanılmalı.
    Development için bu yeterli.
    """
    Base.metadata.create_all(bind=engine)
    print("[OK] Veritabani tablolari olusturuldu")
    yield
    print("[BYE] FocusForge kapatiliyor...")


# FastAPI uygulamasını oluştur
app = FastAPI(
    title="FocusForge API",
    description=(
        "AI Destekli Kisisel Verimlilik & Odaklanma Asistani.\n\n"
        "**Ozellikler:**\n"
        "- Kullanici kayit/giris (JWT)\n"
        "- Gorev yonetimi (CRUD + onceliklendirme)\n"
        "- AI koc sohbet (Gemini API)\n"
        "- Odaklanma seanslari\n"
        "- Verimlilik analitigi\n"
        "- Oyunlastirma (XP, seviye, rozet)"
    ),
    version="0.1.0",
    lifespan=lifespan,
)


# CORS ayarları — Frontend'in backend'e erişebilmesi için
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Vite dev server
        "http://localhost:3000",    # Alternatif frontend port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Router'ları kaydet
app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(chat_router)


@app.get("/", tags=["Genel"])
def root():
    """API sağlık kontrolü."""
    return {
        "app": settings.app_name,
        "version": "0.1.0",
        "status": "çalışıyor",
        "docs": "/docs",
    }


@app.get("/health", tags=["Genel"])
def health_check():
    """Detaylı sağlık kontrolü."""
    return {
        "status": "healthy",
        "database": "connected",
        "ai": "configured" if settings.gemini_api_key else "not_configured",
    }
