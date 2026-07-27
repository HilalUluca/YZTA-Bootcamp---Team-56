"""
Odaklanma Seansi API endpoint'leri.

Endpoints:
    POST   /api/focus/start           -> Yeni seans baslat
    PATCH  /api/focus/{id}/end        -> Seansi bitir ve degerlendir
    GET    /api/focus/                -> Kullanicinin seanslarini listele
    GET    /api/focus/{id}            -> Tek seans getir
    GET    /api/focus/stats/summary   -> Odaklanma istatistikleri
    GET    /api/focus/stats/insights  -> Saat bazlı verimlilik analizi
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database import get_db
from app.models.user import User
from app.models.task import Task
from app.models.focus_session import FocusSession, SessionType
from app.schemas.focus import (
    FocusSessionStart,
    FocusSessionEnd,
    FocusSessionResponse,
    FocusSessionListResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/focus", tags=["Odaklanma Seanslari"])


@router.post("/start", response_model=FocusSessionResponse, status_code=status.HTTP_201_CREATED)
def start_focus_session(
    session_data: FocusSessionStart,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Yeni odaklanma seansi baslatir.

    Opsiyonel olarak hangi gorev uzerinde calisildigini belirtebilirsin.
    Seans turleri: pomodoro_25 (25dk), pomodoro_50 (50dk), custom.
    """
    # Eger task_id verildiyse, gorevin bu kullaniciya ait oldugunu dogrula
    if session_data.task_id:
        task = (
            db.query(Task)
            .filter(Task.id == session_data.task_id, Task.user_id == current_user.id)
            .first()
        )
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gorev bulunamadi veya size ait degil",
            )

    new_session = FocusSession(
        user_id=current_user.id,
        task_id=session_data.task_id,
        session_type=session_data.session_type,
        start_time=datetime.now(timezone.utc),
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return new_session


@router.patch("/{session_id}/end", response_model=FocusSessionResponse)
def end_focus_session(
    session_id: uuid.UUID,
    end_data: FocusSessionEnd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Odaklanma seansini bitirir ve degerlendirme ekler.

    Seans bittiginde:
    - Gecen sure otomatik hesaplanir
    - Verimlilik puani (1-5) kaydedilir
    - Kullaniciya XP verilir
    """
    session = (
        db.query(FocusSession)
        .filter(FocusSession.id == session_id, FocusSession.user_id == current_user.id)
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seans bulunamadi",
        )

    if session.end_time is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu seans zaten bitirilmis",
        )

    # Seansi bitir
    now = datetime.now(timezone.utc)
    session.end_time = now

    # SQLite timezone bilgisi saklamaz, start_time naive gelebilir
    start = session.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    session.duration_minutes = int((now - start).total_seconds() / 60)
    session.productivity_rating = end_data.productivity_rating
    session.notes = end_data.notes
    session.interruption_count = end_data.interruption_count

    # Kullaniciya XP ver (verimlilik puanina gore)
    xp_earned = session.duration_minutes * end_data.productivity_rating
    current_user.total_xp += xp_earned

    # Seviye hesapla (her 500 XP'de 1 seviye)
    current_user.level = (current_user.total_xp // 500) + 1

    db.commit()
    db.refresh(session)

    return session


@router.get("/", response_model=FocusSessionListResponse)
def list_focus_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanicinin odaklanma seanslarini listeler (en yeniler basta)."""
    sessions = (
        db.query(FocusSession)
        .filter(FocusSession.user_id == current_user.id)
        .order_by(desc(FocusSession.created_at))
        .limit(limit)
        .all()
    )

    # Toplam odaklanma suresi
    total_minutes = (
        db.query(func.coalesce(func.sum(FocusSession.duration_minutes), 0))
        .filter(FocusSession.user_id == current_user.id)
        .scalar()
    )

    return FocusSessionListResponse(
        sessions=sessions,
        total=len(sessions),
        total_focus_minutes=total_minutes,
    )


@router.get("/stats/summary")
def get_focus_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kullanicinin odaklanma istatistiklerini dondurur.

    - Toplam seans sayisi
    - Toplam odaklanma suresi (dakika)
    - Ortalama verimlilik puani
    - Mevcut streak
    """
    stats = (
        db.query(
            func.count(FocusSession.id).label("total_sessions"),
            func.coalesce(func.sum(FocusSession.duration_minutes), 0).label("total_minutes"),
            func.coalesce(func.avg(FocusSession.productivity_rating), 0).label("avg_rating"),
        )
        .filter(FocusSession.user_id == current_user.id)
        .first()
    )

    return {
        "total_sessions": stats.total_sessions,
        "total_focus_minutes": stats.total_minutes,
        "total_focus_hours": round(stats.total_minutes / 60, 1),
        "avg_productivity_rating": round(float(stats.avg_rating), 1),
        "current_level": current_user.level,
        "total_xp": current_user.total_xp,
    }


@router.get("/stats/insights")
def get_focus_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Saat bazlı verimlilik analizi.

    Focus session verilerinden:
    - En verimli saat dilimi
    - En verimsiz saat dilimi
    - Saat bazlı dağılım (her saat için ortalama verimlilik)
    - AI yorumu ve önerisi
    """
    from collections import defaultdict
    from datetime import timedelta

    # Tamamlanmış seansları al (verimlilik puanı olanlar)
    sessions = (
        db.query(FocusSession)
        .filter(
            FocusSession.user_id == current_user.id,
            FocusSession.end_time.isnot(None),
            FocusSession.productivity_rating.isnot(None),
        )
        .all()
    )

    if not sessions:
        return {
            "status": "insufficient_data",
            "message": "Henüz tamamlanmış odaklanma seansın yok. Birkaç seans tamamladıktan sonra verimlilik analizi yapılabilir.",
            "total_analyzed": 0,
        }

    # Saat bazlı verimlilik hesapla
    hourly_data = defaultdict(lambda: {"ratings": [], "durations": [], "count": 0})

    for s in sessions:
        if s.start_time:
            hour = s.start_time.hour
            hourly_data[hour]["ratings"].append(s.productivity_rating or 3)
            hourly_data[hour]["durations"].append(s.duration_minutes or 0)
            hourly_data[hour]["count"] += 1

    # Her saat için ortalama hesapla
    hourly_stats = {}
    for hour, data in sorted(hourly_data.items()):
        avg_rating = sum(data["ratings"]) / len(data["ratings"])
        avg_duration = sum(data["durations"]) / len(data["durations"])
        hourly_stats[f"{hour:02d}:00"] = {
            "avg_rating": round(avg_rating, 2),
            "avg_duration_min": round(avg_duration, 1),
            "session_count": data["count"],
        }

    # En verimli ve en verimsiz saatler
    if hourly_stats:
        best_hour = max(hourly_stats.items(), key=lambda x: x[1]["avg_rating"])
        worst_hour = min(hourly_stats.items(), key=lambda x: x[1]["avg_rating"])
    else:
        best_hour = ("N/A", {"avg_rating": 0})
        worst_hour = ("N/A", {"avg_rating": 0})

    # Haftalık trend (son 7 gün vs önceki 7 gün)
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    this_week = [s for s in sessions if s.start_time and s.start_time >= week_ago]
    last_week = [s for s in sessions if s.start_time and two_weeks_ago <= s.start_time < week_ago]

    this_week_avg = sum(s.productivity_rating or 0 for s in this_week) / len(this_week) if this_week else 0
    last_week_avg = sum(s.productivity_rating or 0 for s in last_week) / len(last_week) if last_week else 0

    if last_week_avg > 0:
        trend_pct = round(((this_week_avg - last_week_avg) / last_week_avg) * 100, 1)
        trend_text = f"%{abs(trend_pct)} {'artış' if trend_pct > 0 else 'düşüş'}" if trend_pct != 0 else "Değişim yok"
    else:
        trend_pct = 0
        trend_text = "Karşılaştırma için yeterli veri yok"

    # AI önerisi oluştur
    recommendation = _generate_focus_recommendation(
        best_hour[0], best_hour[1]["avg_rating"],
        worst_hour[0], worst_hour[1]["avg_rating"],
        len(sessions), this_week_avg
    )

    return {
        "total_analyzed": len(sessions),
        "best_hour": {
            "time": best_hour[0],
            "avg_rating": best_hour[1]["avg_rating"],
            "label": f"{best_hour[0]} - En verimli saatin"
        },
        "worst_hour": {
            "time": worst_hour[0],
            "avg_rating": worst_hour[1]["avg_rating"],
            "label": f"{worst_hour[0]} - En az verimli saatin"
        },
        "hourly_breakdown": hourly_stats,
        "weekly_trend": {
            "this_week_avg": round(this_week_avg, 2),
            "last_week_avg": round(last_week_avg, 2),
            "change_percent": trend_pct,
            "trend_text": trend_text,
        },
        "recommendation": recommendation,
    }


def _generate_focus_recommendation(best_time, best_rating, worst_time, worst_rating, total_sessions, weekly_avg):
    """Focus verilerine göre kişiselleştirilmiş öneri üretir."""
    tips = []

    if best_rating >= 4:
        tips.append(f"🎯 {best_time} civarı en verimli saatin ({best_rating}/5). Zor görevlerini bu saate planla.")
    elif best_rating >= 3:
        tips.append(f"📊 {best_time} en iyi saatin ama verimlilik henüz yüksek değil ({best_rating}/5). Dikkat dağıtıcıları azalt.")

    if worst_rating < 3 and worst_time != "N/A":
        tips.append(f"⚠️ {worst_time} saatinde verimlilik düşük ({worst_rating}/5). Bu saatte mola ver veya hafif iş yap.")

    if total_sessions < 5:
        tips.append("📈 Daha fazla seans tamamla ki daha doğru analiz yapabileyim. Hedef: günde en az 1 Pomodoro.")
    elif weekly_avg >= 4:
        tips.append("🔥 Bu hafta harika gidiyorsun! Tempoyu koru.")
    elif weekly_avg >= 3:
        tips.append("💪 İyi bir seviyedesin. Telefonu uzağa koyarak ve sessiz bir ortamda çalışarak daha da artırabilirsin.")
    elif weekly_avg > 0:
        tips.append("🌱 Verimlilik düşük görünüyor. Daha kısa seanslarla (25dk Pomodoro) başla, zamanla artır.")

    return " | ".join(tips) if tips else "Yeterli veri toplandıkça sana özel öneriler burada görünecek."


@router.get("/{session_id}", response_model=FocusSessionResponse)
def get_focus_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tek bir odaklanma seansini getirir."""
    session = (
        db.query(FocusSession)
        .filter(FocusSession.id == session_id, FocusSession.user_id == current_user.id)
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seans bulunamadi",
        )

    return session
