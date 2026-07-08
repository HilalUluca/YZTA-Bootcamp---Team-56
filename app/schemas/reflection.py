"""Gunluk Yansima API semalari (request/response)."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.focus_session import MoodLevel


# --- Yansima Olustur ---

class ReflectionCreate(BaseModel):
    """Gunluk yansima olusturma istegi."""
    mood: MoodLevel = Field(
        description="Ruh hali: great, good, neutral, low, bad"
    )
    energy_level: int = Field(
        ge=1, le=5,
        description="Enerji seviyesi (1-5)"
    )
    wins: Optional[str] = Field(
        None, description="Bugun neler iyi gitti?"
    )
    improvements: Optional[str] = Field(
        None, description="Yarin ne degistirmek istersin?"
    )
    gratitude: Optional[str] = Field(
        None, description="Neler icin minnetarsin?"
    )


# --- Yansima Yaniti ---

class ReflectionResponse(BaseModel):
    """API'den donen yansima bilgisi."""
    id: uuid.UUID
    user_id: uuid.UUID
    date: datetime
    mood: MoodLevel
    energy_level: int
    wins: Optional[str] = None
    improvements: Optional[str] = None
    gratitude: Optional[str] = None
    ai_analysis: dict = {}
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Yansima Listesi ---

class ReflectionListResponse(BaseModel):
    """Yansima listesi yaniti."""
    reflections: list[ReflectionResponse]
    total: int
