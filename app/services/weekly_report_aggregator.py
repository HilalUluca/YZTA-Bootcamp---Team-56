from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.task import Task, TaskStatus
from app.models.focus_session import FocusSession, Reflection, MoodLevel
from app.models.habit import HabitLog, Habit

def aggregate_weekly_metrics(user_id: str, db: Session, end_date: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Toplar: Görevler, Odaklanma, Ruh Hali, Alışkanlıklar.
    end_date belirtilmezse şu anı alır. Son 7 günün istatistiklerini hesaplar.
    """
    if not end_date:
        end_date = datetime.now(timezone.utc)
        
    start_date = end_date - timedelta(days=7)
    
    # --- TASKS ---
    tasks_query = db.query(Task).filter(
        Task.user_id == user_id,
        Task.created_at >= start_date,
        Task.created_at < end_date
    )
    total_tasks = tasks_query.count()
    completed_tasks = tasks_query.filter(Task.status == TaskStatus.DONE).count()
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0

    # --- FOCUS SESSIONS ---
    focus_query = db.query(FocusSession).filter(
        FocusSession.user_id == user_id,
        FocusSession.created_at >= start_date,
        FocusSession.created_at < end_date
    )
    focus_sessions = focus_query.all()
    total_focus_minutes = sum(s.duration_minutes for s in focus_sessions if s.duration_minutes)
    
    # Günlük dağılım (en verimli günü bulmak için)
    daily_focus = {}
    for s in focus_sessions:
        day_str = s.created_at.strftime("%Y-%m-%d")
        daily_focus[day_str] = daily_focus.get(day_str, 0) + (s.duration_minutes or 0)
    
    most_productive_day = max(daily_focus, key=daily_focus.get) if daily_focus else None
    
    # --- REFLECTIONS (MOOD & ENERGY) ---
    reflections_query = db.query(Reflection).filter(
        Reflection.user_id == user_id,
        Reflection.date >= start_date,
        Reflection.date < end_date
    )
    reflections = reflections_query.all()
    
    mood_map = {
        MoodLevel.GREAT: 5,
        MoodLevel.GOOD: 4,
        MoodLevel.NEUTRAL: 3,
        MoodLevel.LOW: 2,
        MoodLevel.BAD: 1
    }
    
    avg_mood = 0.0
    avg_energy = 0.0
    if reflections:
        avg_mood = sum(mood_map.get(r.mood, 3) for r in reflections) / len(reflections)
        avg_energy = sum(r.energy_level for r in reflections) / len(reflections)
        
    # --- HABITS ---
    # Toplam habit sayısı
    total_habits = db.query(Habit).filter(Habit.user_id == user_id).count()
    
    # Bu hafta yapılan loglar
    habit_logs = db.query(HabitLog).join(Habit).filter(
        Habit.user_id == user_id,
        HabitLog.completed_at >= start_date,
        HabitLog.completed_at < end_date
    ).all()
    
    completed_habits_count = len(habit_logs)
    
    # Expected habit logs for a week (simplification: daily habits -> 7 per habit)
    # Gerçek senaryoda daily/weekly ayrı hesaplanabilir. Burada fallback bir oran veriyoruz.
    expected_logs = total_habits * 7
    habit_completion_rate = (completed_habits_count / expected_logs * 100) if expected_logs > 0 else 0.0

    return {
        "period": {
            "start": start_date.strftime("%Y-%m-%d"),
            "end": end_date.strftime("%Y-%m-%d")
        },
        "tasks": {
            "total_created": total_tasks,
            "completed": completed_tasks,
            "completion_rate_percent": round(completion_rate, 1)
        },
        "focus": {
            "total_minutes": total_focus_minutes,
            "sessions_count": len(focus_sessions),
            "most_productive_day": most_productive_day
        },
        "wellbeing": {
            "average_mood_score_out_of_5": round(avg_mood, 1),
            "average_energy_score_out_of_5": round(avg_energy, 1),
            "days_logged": len(reflections)
        },
        "habits": {
            "tracked_habits_count": total_habits,
            "completions_this_week": completed_habits_count,
            "estimated_completion_rate_percent": round(habit_completion_rate, 1)
        }
    }
