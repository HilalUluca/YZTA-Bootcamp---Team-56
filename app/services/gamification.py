"""
Sorumluluk Skoru ve Gamification Servisi.

Kullanicinin davranislarina gore skor hesaplar:
- Gorevi zamaninda bitir   -> +5 puan
- Deadline kacir           -> -10 puan
- Odaklanma seansi tamamla -> +3 puan
- Gunluk yansima yap       -> +2 puan
- Gorevi ertele            -> -3 puan

Skor 0-100 arasi. Baslangic: 50.
AI kocun tonu bu skora gore degisir:
  80+  -> Tesvik edici, ovgu dolu
  50-79 -> Dengeli, stratejik
  30-49 -> Sert ama adil
  0-29  -> Hesap soran, zorlayici
"""

from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.models.task import Task, TaskStatus
from app.models.focus_session import FocusSession, Reflection, DailyStats


# Skor degisim degerleri
SCORE_RULES = {
    "task_completed_on_time": +5,
    "task_completed_late": +2,
    "deadline_missed": -10,
    "focus_session_completed": +3,
    "daily_reflection": +2,
    "task_postponed": -3,
}


def calculate_responsibility_score(user: User, db: Session) -> dict:
    """
    Kullanicinin sorumluluk skorunu hesaplar.

    Returns:
        dict: {
            "score": float (0-100),
            "level": str (excellent/good/fair/poor),
            "coach_tone": str (AI kocun kullanacagi ton),
            "breakdown": dict (skor detayi)
        }
    """
    now = datetime.now(timezone.utc)
    last_7_days = now - timedelta(days=7)

    # Son 7 gundeki tamamlanan gorevler
    completed_tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user.id,
            Task.status == TaskStatus.DONE,
            Task.completed_at >= last_7_days,
        )
        .all()
    )

    # Zamaninda tamamlanan
    on_time = sum(
        1 for t in completed_tasks
        if t.due_date and t.completed_at and t.completed_at <= t.due_date
    )
    # Gec tamamlanan
    late = sum(
        1 for t in completed_tasks
        if t.due_date and t.completed_at and t.completed_at > t.due_date
    )
    # Deadline'i gecmis ama tamamlanmamis
    overdue = (
        db.query(func.count(Task.id))
        .filter(
            Task.user_id == user.id,
            Task.status != TaskStatus.DONE,
            Task.due_date < now,
        )
        .scalar()
    )

    # Son 7 gundeki seanslar
    sessions_count = (
        db.query(func.count(FocusSession.id))
        .filter(
            FocusSession.user_id == user.id,
            FocusSession.end_time.isnot(None),
            FocusSession.created_at >= last_7_days,
        )
        .scalar()
    )

    # Son 7 gundeki yansimalar
    reflections_count = (
        db.query(func.count(Reflection.id))
        .filter(
            Reflection.user_id == user.id,
            Reflection.created_at >= last_7_days,
        )
        .scalar()
    )

    # Skor hesapla (baslangic 50)
    score = 50.0
    score += on_time * SCORE_RULES["task_completed_on_time"]
    score += late * SCORE_RULES["task_completed_late"]
    score += overdue * SCORE_RULES["deadline_missed"]
    score += sessions_count * SCORE_RULES["focus_session_completed"]
    score += reflections_count * SCORE_RULES["daily_reflection"]

    # 0-100 araliginda tut
    score = max(0.0, min(100.0, score))

    # Seviye ve koc tonu belirle
    if score >= 80:
        level = "excellent"
        coach_tone = "Tesvik edici ve ovgu dolu. Kullaniciyi kutla, basarilarini vurgula."
    elif score >= 50:
        level = "good"
        coach_tone = "Dengeli ve stratejik. Destekleyici ama gelistirme alanlarina da degin."
    elif score >= 30:
        level = "fair"
        coach_tone = "Sert ama adil. Net konusmali, somut adimlar sunmali."
    else:
        level = "poor"
        coach_tone = "Hesap soran, zorlayici. Erteleme nedenlerini sorgula, acil plan olustur."

    return {
        "score": round(score, 1),
        "level": level,
        "coach_tone": coach_tone,
        "breakdown": {
            "tasks_on_time": on_time,
            "tasks_late": late,
            "overdue_tasks": overdue,
            "focus_sessions": sessions_count,
            "reflections": reflections_count,
            "total_completed": len(completed_tasks),
        },
        "period": "last_7_days",
    }
