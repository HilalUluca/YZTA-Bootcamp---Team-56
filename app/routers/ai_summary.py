"""
AI Günlük Özet API endpoint'i.

Endpoints:
    GET /api/ai/daily-summary  -> Günün AI özetini üret
"""

import logging
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.task import Task, TaskStatus
from app.models.focus_session import FocusSession, Reflection, MoodLevel
from app.services.auth import get_current_user
from app.config import get_settings

logger = logging.getLogger("focusforge.daily_summary")
router = APIRouter(prefix="/api/ai", tags=["AI Analizler"])

settings = get_settings()


@router.get("/daily-summary")
def get_daily_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Günün AI özetini üretir.

    Toplanan veriler:
    - Bugünkü görev tamamlama durumu
    - Odaklanma seansları ve süresi
    - Mood ve enerji seviyesi
    - Son günlerin trendi

    Döndürdüğü analiz:
    - risk_signals: Dikkat edilmesi gereken uyarılar
    - avg_work_minutes: Bugünkü ortalama çalışma süresi
    - strengths: İyi yapılan şeyler
    - improvements: Geliştirilmesi gerekenler
    - emotional_blocks: Tespit edilen duygusal blokajlar
    - tomorrow_plan: Yarın için AI önerisi
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    # === BUGÜNKÜ VERİLER ===

    # Görev durumu
    tasks_completed_today = (
        db.query(func.count(Task.id))
        .filter(
            Task.user_id == current_user.id,
            Task.status == TaskStatus.DONE,
            Task.completed_at >= today_start,
        )
        .scalar() or 0
    )

    tasks_total_today = (
        db.query(func.count(Task.id))
        .filter(
            Task.user_id == current_user.id,
            Task.created_at >= today_start,
        )
        .scalar() or 0
    )

    tasks_overdue = (
        db.query(func.count(Task.id))
        .filter(
            Task.user_id == current_user.id,
            Task.status != TaskStatus.DONE,
            Task.due_date < now,
        )
        .scalar() or 0
    )

    # Odaklanma seansları
    focus_sessions_today = (
        db.query(FocusSession)
        .filter(
            FocusSession.user_id == current_user.id,
            FocusSession.start_time >= today_start,
            FocusSession.end_time.isnot(None),
        )
        .all()
    )

    total_focus_minutes = sum(s.duration_minutes or 0 for s in focus_sessions_today)
    avg_productivity = (
        sum(s.productivity_rating or 0 for s in focus_sessions_today) / len(focus_sessions_today)
        if focus_sessions_today else 0
    )

    # Bugünkü yansıma
    today_reflection = (
        db.query(Reflection)
        .filter(
            Reflection.user_id == current_user.id,
            Reflection.date >= today_start,
        )
        .first()
    )

    today_mood = today_reflection.mood.value if today_reflection else None
    today_energy = today_reflection.energy_level if today_reflection else None

    # === SON 7 GÜN TRENDİ ===

    # Mood trendi
    recent_reflections = (
        db.query(Reflection)
        .filter(
            Reflection.user_id == current_user.id,
            Reflection.date >= week_ago,
        )
        .order_by(Reflection.date.desc())
        .all()
    )

    mood_map = {"great": 5, "good": 4, "neutral": 3, "low": 2, "bad": 1}
    mood_values = [mood_map.get(r.mood.value if hasattr(r.mood, 'value') else r.mood, 3) for r in recent_reflections]
    avg_mood_week = sum(mood_values) / len(mood_values) if mood_values else 3
    energy_values = [r.energy_level for r in recent_reflections if r.energy_level]
    avg_energy_week = sum(energy_values) / len(energy_values) if energy_values else 3

    # Haftalık focus
    weekly_focus = (
        db.query(func.coalesce(func.sum(FocusSession.duration_minutes), 0))
        .filter(
            FocusSession.user_id == current_user.id,
            FocusSession.start_time >= week_ago,
            FocusSession.end_time.isnot(None),
        )
        .scalar() or 0
    )

    # === ANALİZ OLUŞTUR ===

    risk_signals = []
    strengths = []
    improvements = []
    emotional_blocks = []

    # Risk sinyalleri
    if tasks_overdue > 0:
        risk_signals.append(f"{tasks_overdue} görevin süresi geçmiş. Öncelik sırasına göre tamamla.")
    
    if len(mood_values) >= 3 and all(v <= 2 for v in mood_values[:3]):
        risk_signals.append("Son 3 gündür modun düşük. Kendine zaman ayırmayı unutma.")
    
    if len(energy_values) >= 3 and all(v <= 2 for v in energy_values[:3]):
        risk_signals.append("Enerji seviyen 3 gündür düşük. Uyku düzenini kontrol et.")

    if total_focus_minutes == 0 and now.hour >= 18:
        risk_signals.append("Bugün hiç odaklanma seansı yapmadın.")

    if avg_energy_week < 2.5:
        risk_signals.append("Haftalık enerji ortalaması düşük. Fiziksel aktivite ve uyku kalitesine dikkat et.")

    # Güçlü yönler
    if tasks_completed_today >= 3:
        strengths.append(f"Bugün {tasks_completed_today} görev tamamladın, harika!")
    elif tasks_completed_today > 0:
        strengths.append(f"Bugün {tasks_completed_today} görev tamamladın.")

    if total_focus_minutes >= 60:
        strengths.append(f"{total_focus_minutes} dakika odaklanma — çok iyi bir tempo!")
    elif total_focus_minutes >= 25:
        strengths.append(f"{total_focus_minutes} dakika odaklanma kaydedildi.")

    if avg_productivity >= 4:
        strengths.append("Verimlilik puanın yüksek, kaliteli çalışma yapıyorsun.")

    if today_mood in ["great", "good"]:
        strengths.append("Modun iyi, bu enerjiyi değerlendir!")

    if current_user.streak_count >= 3:
        strengths.append(f"{current_user.streak_count} günlük seri! Kırma.")

    # Gelişim alanları
    if tasks_completed_today == 0 and tasks_total_today > 0:
        improvements.append("Bugün hiç görev tamamlanmamış. Küçük bir görevle başla.")

    if total_focus_minutes < 25 and now.hour >= 15:
        improvements.append("Günün yarısı geçmiş ama neredeyse hiç odaklanma yok. 1 Pomodoro dene.")

    if avg_productivity > 0 and avg_productivity < 3:
        improvements.append("Verimlilik puanı düşük. Dikkat dağıtıcıları (telefon, sosyal medya) uzaklaştır.")

    if weekly_focus < 120:  # Haftalık 2 saatten az
        improvements.append("Haftalık odaklanma süren düşük. Günlük en az 1 Pomodoro hedefle.")

    # Duygusal blokajlar
    if today_mood in ["low", "bad"]:
        emotional_blocks.append("Bugün kendini iyi hissetmiyorsun. Bu normal — küçük bir başarı bile modunu yükseltebilir.")

    if tasks_overdue >= 3:
        emotional_blocks.append("Biriken görevler stres yaratıyor olabilir. Listeni küçük parçalara böl.")

    if avg_mood_week < 2.5:
        emotional_blocks.append("Bu hafta genel mod düşük. Kendinle nazik ol, ilerleme küçük adımlarla olur.")

    # Yarın planı
    tomorrow_parts = []

    # En verimli saat analizi
    all_sessions = (
        db.query(FocusSession)
        .filter(
            FocusSession.user_id == current_user.id,
            FocusSession.end_time.isnot(None),
            FocusSession.productivity_rating.isnot(None),
        )
        .all()
    )

    if all_sessions:
        hourly_ratings = defaultdict(list)
        for s in all_sessions:
            if s.start_time:
                hourly_ratings[s.start_time.hour].append(s.productivity_rating or 3)
        
        if hourly_ratings:
            best_hour = max(hourly_ratings.items(), key=lambda x: sum(x[1]) / len(x[1]))
            tomorrow_parts.append(f"En verimli saatin {best_hour[0]:02d}:00 civarı. Yarın zor görevlerini bu saate planla.")

    if tasks_overdue > 0:
        tomorrow_parts.append(f"Önce {tasks_overdue} gecikmiş görevi hallet.")

    if avg_mood_week < 3:
        tomorrow_parts.append("Yarına pozitif bir notla başla — 5 dakika minnettarlık yaz.")
    else:
        tomorrow_parts.append("Bu tempoyla devam et, küçük molalar vermeyi unutma.")

    tomorrow_plan = " ".join(tomorrow_parts) if tomorrow_parts else "Yarın yeni bir gün. Küçük bir hedefle başla!"

    return {
        "date": now.strftime("%Y-%m-%d"),
        "user": current_user.username,
        "daily_stats": {
            "tasks_completed": tasks_completed_today,
            "tasks_total": tasks_total_today,
            "tasks_overdue": tasks_overdue,
            "focus_minutes": total_focus_minutes,
            "focus_sessions_count": len(focus_sessions_today),
            "avg_productivity": round(avg_productivity, 1),
            "mood": today_mood,
            "energy": today_energy,
        },
        "weekly_context": {
            "avg_mood": round(avg_mood_week, 2),
            "avg_energy": round(avg_energy_week, 2),
            "total_focus_minutes": weekly_focus,
            "streak": current_user.streak_count,
            "level": current_user.level,
            "xp": current_user.total_xp,
        },
        "risk_signals": risk_signals,
        "avg_work_minutes": total_focus_minutes,
        "strengths": strengths,
        "improvements": improvements,
        "emotional_blocks": emotional_blocks,
        "tomorrow_plan": tomorrow_plan,
    }
