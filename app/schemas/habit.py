import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.habit import HabitFrequency, HabitCategory


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
    category: HabitCategory = Field(default=HabitCategory.GROWTH, description="Kategori: must_do veya growth")
    target_value: int = Field(default=1, ge=1, description="Hedeflenen tamamlama miktarı (örn: 30 sayfa için 30)")
    unit: str = Field(default="kez", description="Ölçü birimi (örn: sayfa, saat, bardak, kez)")


# --- Alışkanlık Güncelleme ---

class HabitUpdate(BaseModel):
    """Alışkanlık güncelleme isteği."""
    title: Optional[str] = Field(None, max_length=500, description="Alışkanlık başlığı")
    description: Optional[str] = Field(None, description="Alışkanlık açıklaması")
    frequency: Optional[HabitFrequency] = Field(None, description="Sıklık: daily veya weekly")
    category: Optional[HabitCategory] = Field(None, description="Kategori: must_do veya growth")
    target_value: Optional[int] = Field(None, ge=1, description="Hedeflenen tamamlama miktarı")
    unit: Optional[str] = Field(None, description="Ölçü birimi")


# --- Alışkanlık Yanıtı ---

class HabitResponse(BaseModel):
    """API'den dönen alışkanlık bilgisi."""
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str]
    frequency: HabitFrequency
    category: HabitCategory
    target_value: int
    unit: str
    streak_count: int
    last_completed_at: Optional[datetime]
    created_at: datetime
    
    logs: list[HabitLogResponse] = []

    model_config = {"from_attributes": True}


# --- Alışkanlık Listesi ---

class HabitListResponse(BaseModel):
    """Alışkanlık listesi yanıtı."""
    habits: list[HabitResponse]
    total: int


# --- Alışkanlık Check-in İsteği ---

class HabitCheckInRequest(BaseModel):
    """Alışkanlık check-in (tamamlama) isteği."""
    habit_id: uuid.UUID


# --- Bugünün Alışkanlık Durumu Yanıtı ---

class HabitTodayResponse(BaseModel):
    """Bugünün alışkanlık durumunu (tamamlanma bayrağıyla) dönen şema."""
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    frequency: HabitFrequency
    category: HabitCategory
    target_value: int
    unit: str
    streak_count: int
    is_completed_today: bool
    last_completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Alışkanlık İstatistikleri Yanıtı ---

class HabitStatsResponse(BaseModel):
    """Alışkanlık tamamlama istatistiklerini dönen şema."""
    total_habits: int
    completed_today_count: int
    completion_rate_today: float  # Tamamlanma yüzdesi. Örn: 66.67
    longest_streak: int

