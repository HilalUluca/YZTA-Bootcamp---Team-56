"""Kullanıcı API şemaları (request/response)."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# --- Kayıt ---

class UserRegister(BaseModel):
    """Kullanıcı kayıt isteği."""
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    full_name: Optional[str] = None


# --- Giriş ---

class UserLogin(BaseModel):
    """Kullanıcı giriş isteği."""
    username: str
    password: str


# --- Token ---

class Token(BaseModel):
    """JWT token yanıtı."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token içindeki veri."""
    user_id: Optional[str] = None
    username: Optional[str] = None


# --- Kullanıcı Yanıtı ---

class UserResponse(BaseModel):
    """API'den dönen kullanıcı bilgisi. Şifre içermez."""
    id: uuid.UUID
    email: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    total_xp: int = 0
    level: int = 1
    streak_count: int = 0
    responsibility_score: float = 50.0
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Profil Güncelleme ---

class UserUpdate(BaseModel):
    """Kullanıcı profil güncelleme."""
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None


# --- Onboarding (Cold-Start) ---

class OnboardingData(BaseModel):
    """
    İlk kayıtta kullanıcıdan alınan bilgiler.
    AI'ın 1. günden anlamlı önerilerde bulunabilmesi için.
    """
    goals: list[str] = Field(
        default_factory=list,
        description="Kullanıcının 2026 hedefleri (max 5)"
    )
    work_hours_start: Optional[str] = Field(
        default=None, description="Çalışmaya başladığı saat, ör: '09:00'"
    )
    work_hours_end: Optional[str] = Field(
        default=None, description="Çalışmayı bıraktığı saat, ör: '18:00'"
    )
    biggest_challenge: Optional[str] = Field(
        default=None,
        description="En büyük verimlilik sorunu: 'procrastination', 'focus', 'prioritization', 'motivation'"
    )
    preferred_technique: Optional[str] = Field(
        default=None,
        description="Tercih ettiği teknik: 'pomodoro', 'timeblocking', 'none'"
    )
