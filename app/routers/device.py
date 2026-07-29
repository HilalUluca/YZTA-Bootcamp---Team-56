"""
Cihaz (telefon) verisi API endpoint'leri — YZTA-151.

Endpoints:
    POST /api/device/sync       -> Bir günün cihaz verisini kaydet/güncelle
    GET  /api/device/stats      -> Ham cihaz verilerini döndür
    GET  /api/device/insights   -> Analiz: boşa harcanan saatler + öneriler
    POST /api/device/auto-plan  -> Boş saatlere otomatik görev/odak planla

Strateji notu: gerçek Screen Time / Digital Wellbeing API'lerine bağlanmıyoruz.
İstemci (emülatör/simülasyon) veriyi üretip `sync` ile gönderir; şema gerçek
entegrasyonla aynı olduğu için ileride yalnızca besleyen taraf değişir.
"""

import logging
from datetime import date as date_type, datetime, time, timezone
from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.device import DeviceUsage
from app.models.user import User
from app.schemas.device import (
    AutoPlanRequest,
    AutoPlanResponse,
    DeviceInsightsResponse,
    DeviceStatsResponse,
    DeviceStatsTotals,
    DeviceSyncRequest,
    DeviceSyncResponse,
    DeviceUsageResponse,
    ScheduledTask,
)
from app.services import device_insights
from app.services.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/device", tags=["Cihaz Verisi"])

# auto-plan ile açılan görevlere basılan etiket. Aynı gün tekrar çalıştırılırsa
# görevleri çoğaltmamak ve kullanıcının bunları AI'ın koyduğunu görmesi için.
AUTO_PLAN_TAG = "ai-auto-plan"


def _today() -> date_type:
    return datetime.now(timezone.utc).date()


# --- POST /sync ---------------------------------------------------------------

@router.post("/sync", response_model=DeviceSyncResponse, status_code=status.HTTP_200_OK)
def sync_device_data(
    payload: DeviceSyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Bir güne ait cihaz verisini kaydeder.

    Aynı gün için tekrar gönderilirse mevcut satır GÜNCELLENİR (upsert);
    böylece gün içinde birden çok kez senkronlamak veriyi çoğaltmaz.
    """
    target_date = payload.date or _today()

    entry = (
        db.query(DeviceUsage)
        .filter(DeviceUsage.user_id == current_user.id, DeviceUsage.date == target_date)
        .first()
    )
    created = entry is None

    if entry is None:
        entry = DeviceUsage(user_id=current_user.id, date=target_date)
        db.add(entry)

    entry.screen_time_hours = payload.screen_time_hours
    entry.screen_time_breakdown = payload.screen_time_breakdown
    entry.hourly_usage = payload.hourly_usage
    entry.step_count = payload.step_count
    entry.sleep_hours = payload.sleep_hours
    entry.calendar_events = [event.model_dump() for event in payload.calendar_events]

    db.commit()
    db.refresh(entry)

    return DeviceSyncResponse(
        created=created,
        entry=DeviceUsageResponse.model_validate(entry),
        message=(
            f"{target_date} verisi kaydedildi."
            if created
            else f"{target_date} verisi güncellendi."
        ),
    )


# --- GET /stats ---------------------------------------------------------------

@router.get("/stats", response_model=DeviceStatsResponse)
def get_device_stats(
    days: int = Query(7, ge=1, le=90, description="Son kaç güne bakılsın"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ham cihaz verilerini döndürür (yorum yok, analiz yok).

    Ortalamalar yalnızca VERİ OLAN günlere bölünür; senkronlanmamış günler
    ortalamayı aşağı çekmez.
    """
    entries = device_insights.get_entries(db, current_user.id, days)

    screen_values = [e.screen_time_hours or 0.0 for e in entries]
    sleep_values = [e.sleep_hours for e in entries if e.sleep_hours]
    step_values = [e.step_count for e in entries if e.step_count]

    app_totals: dict[str, float] = {}
    for entry in entries:
        for app_name, hours in (entry.screen_time_breakdown or {}).items():
            key = device_insights.display_app(app_name)
            app_totals[key] = app_totals.get(key, 0.0) + float(hours or 0)

    top_apps = dict(
        sorted(app_totals.items(), key=lambda kv: kv[1], reverse=True)[:10]
    )

    def avg(values: List[float]) -> float:
        return sum(values) / len(values) if values else 0.0

    return DeviceStatsResponse(
        requested_days=days,
        entries=[DeviceUsageResponse.model_validate(e) for e in entries],
        totals=DeviceStatsTotals(
            days_with_data=len(entries),
            avg_screen_time_hours=round(avg(screen_values), 2),
            avg_sleep_hours=round(avg(sleep_values), 2),
            avg_step_count=int(round(avg([float(s) for s in step_values]))),
            total_screen_time_hours=round(sum(screen_values), 2),
            top_apps={k: round(v, 2) for k, v in top_apps.items()},
        ),
    )


# --- GET /insights ------------------------------------------------------------

def _signals_text(db: Session, user_id, days: int) -> str:
    """LLM'e verilecek kısa bağlam: uyku ve adım ortalaması."""
    entries = device_insights.get_entries(db, user_id, days)
    sleep = [e.sleep_hours for e in entries if e.sleep_hours]
    steps = [e.step_count for e in entries if e.step_count]
    parts = []
    if sleep:
        parts.append(f"ortalama uyku {sum(sleep) / len(sleep):.1f} saat")
    if steps:
        parts.append(f"ortalama adım {int(sum(steps) / len(steps))}")
    return ", ".join(parts)


@router.get("/insights", response_model=DeviceInsightsResponse)
async def get_device_insights(
    days: int = Query(
        device_insights.DEFAULT_WINDOW_DAYS, ge=1, le=90, description="Analiz penceresi"
    ),
    use_ai: bool = Query(
        True, description="Öneri cümlelerini LLM ile yaz (kapalıysa kural tabanlı)"
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Boşa harcanan saatleri bulur ve öneri üretir.

    Sayılar (hangi saat, kaç dakika, kaç saat geri kazanılabilir) veriden
    deterministik hesaplanır — LLM'e sorulmaz. LLM yalnızca öneri cümlelerini
    yazar; erişilemezse kural tabanlı cümleler kullanılır ve
    `recommendations_source` alanı bunu belli eder.
    """
    insights = device_insights.build_insights(db, current_user.id, days)
    insights.pop("_slots_used", None)

    if use_ai and insights["wasted_slots"]:
        from app.agents.device_insight_agent import enrich_recommendations

        try:
            insights["ai_recommendations"] = await enrich_recommendations(
                insights, signals=_signals_text(db, current_user.id, days)
            )
            insights["recommendations_source"] = "ai"
        except Exception as exc:  # noqa: BLE001 — analiz LLM olmadan da çalışmalı
            logger.warning(
                "LLM önerileri üretilemedi, kural tabanlı yedeğe düşülüyor: %s", exc
            )

    return DeviceInsightsResponse(**insights)


# --- POST /auto-plan ----------------------------------------------------------

@router.post("/auto-plan", response_model=AutoPlanResponse)
def create_auto_plan(
    payload: AutoPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Boşa giden saatlere kullanıcının açık görevlerini yerleştirir.

    Ne yapar: her uygun boşluk için, kullanıcının GERÇEK açık görevlerinden
    birine o saate `due_date` yazar (görev uydurmaz) ve göreve `ai-auto-plan`
    etiketi basar.

    Ne yapmaz: odak seansı KAYDI oluşturmaz. `focus_sessions` yalnızca öneridir;
    seans kaydı ancak kullanıcı gerçekten odaklandığında `POST /api/focus/start`
    ile açılmalı — aksi halde "bugün 0 dk odaklandın" istatistiği bozulur.

    Idempotent: aynı gün tekrar çalıştırılırsa zaten planlanmış görev yeniden
    planlanmaz (`created: false` ile döner).
    """
    target_date = payload.date or _today()

    insights = device_insights.build_insights(
        db, current_user.id, device_insights.DEFAULT_WINDOW_DAYS, payload.max_tasks
    )
    slots = insights.get("_slots_used", [])

    if not slots:
        return AutoPlanResponse(
            dry_run=payload.dry_run,
            scheduled_tasks=[],
            focus_sessions=[],
            message=(
                "Planlanacak boş zaman bulunamadı. Önce POST /api/device/sync ile "
                "saat bazlı kullanım verisi gönder."
            ),
        )

    open_tasks = device_insights.get_open_tasks(db, current_user.id, payload.max_tasks)
    if not open_tasks:
        return AutoPlanResponse(
            dry_run=payload.dry_run,
            scheduled_tasks=[],
            focus_sessions=insights["auto_plan_suggestion"]["focus_sessions"],
            message="Açık görevin yok; yalnızca odak seansı önerisi üretildi.",
        )

    scheduled: List[ScheduledTask] = []

    for task, slot in zip(open_tasks, slots):
        slot_start = datetime.combine(
            target_date, time(hour=slot["start_hour"]), tzinfo=timezone.utc
        )

        # Bu görev zaten aynı saate planlanmışsa dokunma.
        already = (
            task.due_date is not None
            and AUTO_PLAN_TAG in (task.tags or [])
            and task.due_date.replace(tzinfo=timezone.utc) == slot_start
        )

        if not already and not payload.dry_run:
            task.due_date = slot_start
            tags = list(task.tags or [])
            if AUTO_PLAN_TAG not in tags:
                tags.append(AUTO_PLAN_TAG)
            task.tags = tags

        scheduled.append(
            ScheduledTask(
                id=None if payload.dry_run else str(task.id),
                title=task.title,
                scheduled_at=slot_start.isoformat(),
                created=not already,
            )
        )

    if not payload.dry_run:
        db.commit()

    new_count = sum(1 for s in scheduled if s.created)
    return AutoPlanResponse(
        dry_run=payload.dry_run,
        scheduled_tasks=scheduled,
        focus_sessions=insights["auto_plan_suggestion"]["focus_sessions"],
        message=(
            f"{len(scheduled)} görev için plan hazırlandı (kaydedilmedi — dry_run)."
            if payload.dry_run
            else f"{new_count} görev planlandı, {len(scheduled) - new_count} görev zaten planlıydı."
        ),
    )
