"""
Cihaz verisi API şemaları — YZTA-151.

Sync (yazma), stats (ham veri), insights (analiz) ve auto-plan (planlama)
uçlarının istek/yanıt modelleri.
"""

from datetime import date as date_type
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


# --- Ortak parçalar ---

class CalendarEvent(BaseModel):
    """Takvim etkinliği. Saatler günün 'HH:MM' formatında."""

    title: str = Field(max_length=255)
    start: str = Field(description="Başlangıç saati, 'HH:MM'")
    end: str = Field(description="Bitiş saati, 'HH:MM'")

    @field_validator("start", "end")
    @classmethod
    def _valid_clock(cls, v: str) -> str:
        parts = v.split(":")
        if len(parts) != 2 or not all(p.isdigit() for p in parts):
            raise ValueError("Saat 'HH:MM' formatında olmalı")
        hour, minute = int(parts[0]), int(parts[1])
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError("Geçersiz saat")
        return f"{hour:02d}:{minute:02d}"


# --- POST /api/device/sync ---

class DeviceSyncRequest(BaseModel):
    """
    Bir güne ait cihaz kullanım verisi.

    `hourly_usage` sözlüğünün anahtarı günün saati ("0"-"23"), değeri o saatte
    uygulama başına harcanan DAKİKA'dır:
        {"14": {"youtube": 30, "tiktok": 25}, "20": {"twitter": 60}}
    Analiz (wasted_slots) bu alandan üretilir; boş bırakılırsa o gün için
    saat bazlı içgörü çıkmaz.
    """

    date: Optional[date_type] = Field(
        None, description="Hangi güne ait. Boşsa bugün kabul edilir."
    )
    screen_time_hours: float = Field(0.0, ge=0, le=24)
    screen_time_breakdown: Dict[str, float] = Field(
        default_factory=dict, description='Uygulama başına SAAT: {"instagram": 2.1}'
    )
    hourly_usage: Dict[str, Dict[str, float]] = Field(
        default_factory=dict, description='Saat -> uygulama -> DAKİKA'
    )
    step_count: int = Field(0, ge=0)
    sleep_hours: float = Field(0.0, ge=0, le=24)
    calendar_events: List[CalendarEvent] = Field(default_factory=list)

    @field_validator("hourly_usage")
    @classmethod
    def _valid_hours(
        cls, v: Dict[str, Dict[str, float]]
    ) -> Dict[str, Dict[str, float]]:
        normalized: Dict[str, Dict[str, float]] = {}
        for hour_key, apps in v.items():
            if not str(hour_key).isdigit() or not (0 <= int(hour_key) <= 23):
                raise ValueError(
                    f"hourly_usage anahtarı 0-23 arası saat olmalı, gelen: {hour_key!r}"
                )
            for app_name, minutes in apps.items():
                if minutes < 0:
                    raise ValueError(f"{app_name} için negatif dakika olamaz")
                if minutes > 60:
                    raise ValueError(
                        f"{hour_key}. saatte {app_name} için {minutes} dk — "
                        "bir saatte 60 dakikadan fazla kullanım olamaz"
                    )
            # Anahtarı normalize et ki "07" ve "7" iki ayrı saat sayılmasın.
            normalized[str(int(hour_key))] = apps
        return normalized


class DeviceUsageResponse(BaseModel):
    """Kaydedilmiş bir günün ham verisi."""

    date: date_type
    screen_time_hours: float
    screen_time_breakdown: Dict[str, float]
    hourly_usage: Dict[str, Dict[str, float]]
    step_count: int
    sleep_hours: float
    calendar_events: List[CalendarEvent]

    model_config = {"from_attributes": True}


class DeviceSyncResponse(BaseModel):
    """Sync sonucu."""

    created: bool = Field(description="Yeni kayıt mı açıldı, mevcut gün mü güncellendi")
    entry: DeviceUsageResponse
    message: str


# --- GET /api/device/stats ---

class DeviceStatsTotals(BaseModel):
    """Sorgulanan pencerenin toplamları/ortalamaları."""

    days_with_data: int
    avg_screen_time_hours: float
    avg_sleep_hours: float
    avg_step_count: int
    total_screen_time_hours: float
    top_apps: Dict[str, float] = Field(description="Uygulama -> toplam SAAT")


class DeviceStatsResponse(BaseModel):
    """Ham cihaz verileri + basit toplamlar."""

    requested_days: int
    entries: List[DeviceUsageResponse]
    totals: DeviceStatsTotals


# --- GET /api/device/insights ---

class WastedSlot(BaseModel):
    """Boşa gittiği tespit edilen bitişik zaman aralığı."""

    time: str = Field(description="Örn: '14:00-15:30'")
    apps: List[str]
    duration_min: int


class FocusSessionSuggestion(BaseModel):
    """Bir boşluğa önerilen odak seansı bloğu."""

    start: str
    type: str = Field(description="pomodoro_25 / pomodoro_50 / custom")
    count: int


class AutoPlanSuggestion(BaseModel):
    """Otomatik plan önerisi (henüz kaydedilmemiş)."""

    tasks_to_schedule: List[str] = Field(
        description="Örn: 'Algoritma çalış → 14:00'"
    )
    focus_sessions: List[FocusSessionSuggestion]


class DeviceInsightsResponse(BaseModel):
    """AI analizi: boşa harcanan saatler + öneriler."""

    wasted_slots: List[WastedSlot]
    recoverable_hours_weekly: float
    ai_recommendations: List[str]
    auto_plan_suggestion: AutoPlanSuggestion

    # Sayıların nereden geldiği görülebilsin diye (spec dışı, denetlenebilirlik için)
    analysis_window_days: int
    days_with_data: int
    daily_wasted_minutes_avg: float
    recommendations_source: str = Field(
        description="'ai' (Gemini) veya 'rules' (kural tabanlı yedek)"
    )


# --- POST /api/device/auto-plan ---

class AutoPlanRequest(BaseModel):
    """Otomatik planlama isteği."""

    date: Optional[date_type] = Field(
        None, description="Planın yazılacağı gün. Boşsa bugün."
    )
    max_tasks: int = Field(3, ge=1, le=10, description="En fazla kaç görev planlansın")
    dry_run: bool = Field(
        False, description="True ise hiçbir şey kaydedilmez, sadece plan döner"
    )


class ScheduledTask(BaseModel):
    """auto-plan'in oluşturduğu (veya oluşturacağı) görev."""

    id: Optional[str] = Field(None, description="dry_run'da boş")
    title: str
    scheduled_at: str = Field(description="ISO 8601")
    created: bool = Field(description="False ise bu görev zaten planlanmıştı")


class AutoPlanResponse(BaseModel):
    """Otomatik plan sonucu."""

    dry_run: bool
    scheduled_tasks: List[ScheduledTask]
    focus_sessions: List[FocusSessionSuggestion]
    message: str
