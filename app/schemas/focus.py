"""Odaklanma Seansi API semalari (request/response)."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.focus_session import SessionType


# --- Seans Baslat ---

class FocusSessionStart(BaseModel):
    """Yeni odaklanma seansi baslatma istegi."""
    task_id: Optional[uuid.UUID] = Field(
        None, description="Hangi gorev uzerinde calisiyorsun (opsiyonel)"
    )
    session_type: SessionType = Field(
        SessionType.POMODORO_25,
        description="Seans turu: pomodoro_25, pomodoro_50, custom"
    )
    planned_duration: Optional[int] = Field(
        None, description="Custom seans icin sure (dakika)"
    )


# --- Seans Bitir ---

class FocusSessionEnd(BaseModel):
    """Seansi bitirirken gonderilen degerlendirme."""
    productivity_rating: int = Field(
        ge=1, le=5,
        description="Verimlilik puani (1-5 arasi)"
    )
    notes: Optional[str] = Field(
        None, description="Seans hakkinda kisa not"
    )
    interruption_count: int = Field(
        0, description="Kac kez bolundun"
    )


# --- Seans Yaniti ---

class FocusSessionResponse(BaseModel):
    """API'den donen seans bilgisi."""
    id: uuid.UUID
    user_id: uuid.UUID
    task_id: Optional[uuid.UUID] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    session_type: SessionType
    productivity_rating: Optional[int] = None
    notes: Optional[str] = None
    interruption_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Seans Listesi ---

class FocusSessionListResponse(BaseModel):
    """Seans listesi yanitii."""
    sessions: list[FocusSessionResponse]
    total: int
    total_focus_minutes: int = 0
