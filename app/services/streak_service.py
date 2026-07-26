"""
Kullanıcı seviyesinde günlük seri (streak) hesaplama (YZTA-52).

Not: `User.streak_count` alanı sistemde hiçbir yerde artırılmıyordu; bu yüzden
streak göstergesi ve "5 gün serisi" rozeti çalışmıyordu. Streak'i kalıcı bir
sayaç olarak tutmak yerine (kaçırılan gün, saat dilimi vb. ile kolayca bozulur)
her seferinde aktiviteden hesaplıyoruz.

"Hedef tutturulan gün" tanımı: kullanıcının o gün en az bir üretken eylem
yaptığı gün — tamamlanan görev, biten odak seansı veya günlük yansıma.
"""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.task import Task, TaskStatus
from app.models.focus_session import FocusSession, Reflection


def get_active_dates(db: Session, user_id, lookback_days: int = 90) -> set[date]:
    """Son `lookback_days` gün içinde kullanıcının aktif olduğu (UTC) tarihleri döner."""
    start = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    active: set[date] = set()

    # Tamamlanan görevler
    completed = (
        db.query(Task.completed_at)
        .filter(
            Task.user_id == user_id,
            Task.status == TaskStatus.DONE,
            Task.completed_at.isnot(None),
            Task.completed_at >= start,
        )
        .all()
    )
    active.update(dt.date() for (dt,) in completed if dt)

    # Biten odak seansları
    sessions = (
        db.query(FocusSession.created_at)
        .filter(
            FocusSession.user_id == user_id,
            FocusSession.end_time.isnot(None),
            FocusSession.created_at >= start,
        )
        .all()
    )
    active.update(dt.date() for (dt,) in sessions if dt)

    # Günlük yansımalar
    reflections = (
        db.query(Reflection.date)
        .filter(Reflection.user_id == user_id, Reflection.date >= start)
        .all()
    )
    active.update(dt.date() for (dt,) in reflections if dt)

    return active


def calculate_streak(db: Session, user_id) -> int:
    """
    Bugünden geriye doğru üst üste kaç gün hedef tutturulduğunu sayar.

    Bugün henüz aktif değilse seriyi bozmayız (gün bitmedi); dünden başlar sayarız.
    İlk boşlukta seri kesilir.
    """
    active = get_active_dates(db, user_id)
    if not active:
        return 0

    today = datetime.now(timezone.utc).date()
    # Bugün aktifse bugünden, değilse dünden başla (bugün için "gün bitmedi" toleransı).
    cursor = today if today in active else today - timedelta(days=1)

    streak = 0
    while cursor in active:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
