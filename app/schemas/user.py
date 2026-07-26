"""Kullanıcı API şemaları (request/response)."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

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
    ai_profile: Optional[dict] = None
    onboarding_completed: bool = False
    created_at: datetime

    @classmethod
    def model_validate(cls, obj, **kwargs):
        """ai_profile içinden onboarding_completed çıkar."""
        result = super().model_validate(obj, **kwargs)
        if result.ai_profile and result.ai_profile.get("onboarding_completed"):
            result.onboarding_completed = True
        return result

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
    Sistemin Director ajanı için stratejik veri seti.
    'Work hours' yerine 'Biyolojik ve Stratejik Kapasite' verileri.
    """
    
    # Kişisel ve Mesleki
    age: Optional[int] = Field(None, description="Yaş (Bilişsel kapasite analizi için)")
    profession: Optional[str] = Field(None, description="Odak alanı / Meslek")
    
    # Stratejik Hedefler ve Dirençler
    primary_goals: List[str] = Field(
        default_factory=list, 
        description="2026 odak hedefleri (max 5)"
    )
    weaknesses: List[str] = Field(
        default_factory=list, 
        description="Gelişim ve direnç alanları"
    )
    
    # Biyolojik ve Operasyonel
    hobbies: List[str] = Field(
        default_factory=list, 
        description="Stres anında dopamin reset araçları"
    )
    sleep_pattern: Optional[str] = Field(
        None, description="Uyku kalitesi ve süresi: '6 saat düzensiz', '8 saat düzenli' vb."
    )
    
    # Zaman Bütçesi (Bahane kabul etmeyen veriler)
    average_screen_time: Optional[str] = Field(
        None, description="Günlük ortalama dijital tüketim (ekran süresi)"
    )
    routine_hours_per_day: Optional[str] = Field(
        None, description="Hedeflerin için ayırdığın net saat"
    )

    model_config = {"extra": "allow"} # Esneklik için

    biggest_challenge: Optional[str] = Field(
        default=None,
        description="En büyük verimlilik sorunu: 'procrastination', 'focus', 'prioritization', 'motivation'"
    )
    preferred_technique: Optional[str] = Field(
        default=None,
        description="Tercih ettiği teknik: 'pomodoro', 'timeblocking', 'none'"
    )
