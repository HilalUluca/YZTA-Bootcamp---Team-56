"""
Dashboard & Istatistik API endpoint'leri.

Endpoints:
    GET  /api/stats/dashboard     -> Dashboard ozet verileri
    POST /api/tasks/daily-plan    -> AI ile gunluk plan olustur
    POST /api/tasks/bulk-create   -> Toplu gorev olusturma
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.models.user import User
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.focus_session import FocusSession, Reflection
from app.services.auth import get_current_user
from app.services.gamification import calculate_responsibility_score

router = APIRouter(prefix="/api/stats", tags=["Dashboard & Istatistik"])


@router.get("/dashboard")
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Dashboard icin tek endpoint'te tum ozet verileri dondurur.

    Frontend bu endpoint'i cagirarak dashboard'u doldurur:
    - Bugunun gorev durumu
    - Odaklanma istatistikleri
    - Gamification verileri
    - Sorumluluk skoru
    - Son aktiviteler
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # --- GOREV ISTATISTIKLERI ---
    total_tasks = (
        db.query(func.count(Task.id))
        .filter(Task.user_id == current_user.id, Task.status != TaskStatus.CANCELLED)
        .scalar()
    )

    open_tasks = (
        db.query(func.count(Task.id))
        .filter(
            Task.user_id == current_user.id,
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
        )
        .scalar()
    )

    completed_today = (
        db.query(func.count(Task.id))
        .filter(
            Task.user_id == current_user.id,
            Task.status == TaskStatus.DONE,
            Task.completed_at >= today_start,
        )
        .scalar()
    )

    overdue_tasks = (
        db.query(func.count(Task.id))
        .filter(
            Task.user_id == current_user.id,
            Task.status != TaskStatus.DONE,
            Task.due_date < now,
        )
        .scalar()
    )

    # Bugunun gorevleri (acik olanlar, oncelik sirasina gore)
    todays_tasks = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
        )
        .order_by(Task.priority.asc())
        .limit(10)
        .all()
    )

    todays_tasks_list = [
        {
            "id": str(t.id),
            "title": t.title,
            "priority": t.priority.value if t.priority else "low",
            "status": t.status.value,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "estimated_minutes": t.estimated_minutes,
        }
        for t in todays_tasks
    ]

    # --- ODAKLANMA ISTATISTIKLERI ---
    focus_today = (
        db.query(func.coalesce(func.sum(FocusSession.duration_minutes), 0))
        .filter(
            FocusSession.user_id == current_user.id,
            FocusSession.created_at >= today_start,
        )
        .scalar()
    )

    sessions_today = (
        db.query(func.count(FocusSession.id))
        .filter(
            FocusSession.user_id == current_user.id,
            FocusSession.created_at >= today_start,
        )
        .scalar()
    )

    total_focus_minutes = (
        db.query(func.coalesce(func.sum(FocusSession.duration_minutes), 0))
        .filter(FocusSession.user_id == current_user.id)
        .scalar()
    )

    # --- SORUMLULUK SKORU ---
    score_data = calculate_responsibility_score(current_user, db)

    # --- SON YANSIMA ---
    last_reflection = (
        db.query(Reflection)
        .filter(Reflection.user_id == current_user.id)
        .order_by(Reflection.date.desc())
        .first()
    )

    last_reflection_data = None
    if last_reflection:
        last_reflection_data = {
            "mood": last_reflection.mood.value,
            "energy_level": last_reflection.energy_level,
            "date": last_reflection.date.isoformat(),
        }

    return {
        "user": {
            "username": current_user.username,
            "full_name": current_user.full_name,
            "level": current_user.level,
            "total_xp": current_user.total_xp,
            "streak_count": current_user.streak_count,
        },
        "tasks": {
            "total": total_tasks,
            "open": open_tasks,
            "completed_today": completed_today,
            "overdue": overdue_tasks,
            "todays_list": todays_tasks_list,
        },
        "focus": {
            "minutes_today": focus_today,
            "sessions_today": sessions_today,
            "total_minutes": total_focus_minutes,
            "total_hours": round(total_focus_minutes / 60, 1),
        },
        "score": {
            "value": score_data["score"],
            "level": score_data["level"],
            "coach_tone": score_data["coach_tone"],
        },
        "last_reflection": last_reflection_data,
        "generated_at": now.isoformat(),
    }
