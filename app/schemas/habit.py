import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.habit import HabitFrequency


# --- Alışkanlık Tamamlama Geçmişi (Log) ---

class HabitLogResponse(BaseModel):
    """Alışkanlık tamamlandığında dönen log kaydı."""
    id: uuid.UUID
    habit_id: uuid.UUID
    completed_at: datetime

    model_config = {"from_attributes": True}


# --- Alışkanlık Oluşturma ---

class HabitCreate(BaseModel):
    """Yeni alışkanlık oluşturma isteği."""
    title: str = Field(..., max_length=500, description="Alışkanlık başlığı. Örn: Kitap Okumak")
    description: Optional[str] = Field(None, description="Alışkanlık açıklaması veya detayları")
    frequency: HabitFrequency = Field(default=HabitFrequency.DAILY, description="Sıklık: daily veya weekly")


# --- Alışkanlık Güncelleme ---

class HabitUpdate(BaseModel):
    """Alışkanlık güncelleme isteği."""
    title: Optional[str] = Field(None, max_length=500, description="Alışkanlık başlığı")
    description: Optional[str] = Field(None, description="Alışkanlık açıklaması")
    frequency: Optional[HabitFrequency] = Field(None, description="Sıklık: daily veya weekly")


# --- Alışkanlık Yanıtı ---

class HabitResponse(BaseModel):
    """API'den dönen alışkanlık bilgisi."""
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str]
    frequency: HabitFrequency
    streak_count: int
    last_completed_at: Optional[datetime]
    created_at: datetime
    
    # logs listesini de opsiyonel olarak şemada sunabiliriz
    logs: list[HabitLogResponse] = []

    model_config = {"from_attributes": True}


# --- Alışkanlık Listesi ---

class HabitListResponse(BaseModel):
    """Alışkanlık listesi yanıtı."""
    habits: list[HabitResponse]
    total: int
