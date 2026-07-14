"""
Odaklanma Seansi API endpoint'leri.

Endpoints:
    POST   /api/focus/start           -> Yeni seans baslat
    PATCH  /api/focus/{id}/end        -> Seansi bitir ve degerlendir
    GET    /api/focus/                -> Kullanicinin seanslarini listele
    GET    /api/focus/{id}            -> Tek seans getir
    GET    /api/focus/stats/summary   -> Odaklanma istatistikleri
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
