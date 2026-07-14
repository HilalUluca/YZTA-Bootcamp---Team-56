import uuid
from datetime import datetime, timezone, date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.habit import Habit, HabitLog, HabitFrequency
from app.schemas.habit import (
    HabitCreate,
    HabitUpdate,
    HabitResponse,
    HabitListResponse,
    HabitLogResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/habits", tags=["Aliskanliklar"])


@router.post("/", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
def create_habit(
    habit_data: HabitCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Yeni bir alışkanlık oluşturur."""
    new_habit = Habit(
        user_id=current_user.id,
        title=habit_data.title,
        description=habit_data.description,
        frequency=habit_data.frequency,
        streak_count=0,
        last_completed_at=None,
    )
    db.add(new_habit)
    db.commit()
    db.refresh(new_habit)
    return new_habit


@router.get("/", response_model=HabitListResponse)
def list_habits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Giriş yapmış kullanıcının alışkanlıklarını listeler."""
    habits = (
        db.query(Habit)
        .filter(Habit.user_id == current_user.id)
        .order_by(desc(Habit.created_at))
        .all()
    )
    return HabitListResponse(
        habits=habits,
        total=len(habits),
    )


@router.get("/{habit_id}", response_model=HabitResponse)
def get_habit(
    habit_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Belirli bir alışkanlığın detaylarını getirir."""
    habit = (
        db.query(Habit)
        .filter(Habit.id == habit_id, Habit.user_id == current_user.id)
        .first()
    )
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alışkanlık bulunamadı.",
        )
    return habit


@router.put("/{habit_id}", response_model=HabitResponse)
def update_habit(
    habit_id: uuid.UUID,
    habit_data: HabitUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Belirli bir alışkanlığı günceller."""
    habit = (
        db.query(Habit)
        .filter(Habit.id == habit_id, Habit.user_id == current_user.id)
        .first()
    )
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alışkanlık bulunamadı.",
        )

    if habit_data.title is not None:
        habit.title = habit_data.title
    if habit_data.description is not None:
        habit.description = habit_data.description
    if habit_data.frequency is not None:
        habit.frequency = habit_data.frequency

    db.commit()
    db.refresh(habit)
    return habit


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Belirli bir alışkanlığı siler."""
    habit = (
        db.query(Habit)
        .filter(Habit.id == habit_id, Habit.user_id == current_user.id)
        .first()
    )
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alışkanlık bulunamadı.",
        )

    db.delete(habit)
    db.commit()
    return None


@router.post("/{habit_id}/complete", response_model=HabitResponse)
def complete_habit(
    habit_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Alışkanlığı bugün için tamamlandı olarak işaretler ve XP/Sorumluluk skoru ödülü verir."""
    habit = (
        db.query(Habit)
        .filter(Habit.id == habit_id, Habit.user_id == current_user.id)
        .first()
    )
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alışkanlık bulunamadı.",
        )

    now_utc = datetime.now(timezone.utc)
    today_date = now_utc.date()

    # Bugün zaten tamamlanmış mı kontrol et
    # HabitLog'larda bugün tarihli kayıt var mı bakıyoruz
    for log in habit.logs:
        # log.completed_at timezone-aware olduğundan karşılaştırırken dikkat
        if log.completed_at.date() == today_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu alışkanlık bugün zaten tamamlanmış.",
            )

    # 1. Yeni tamamlanma logunu oluştur
    new_log = HabitLog(habit_id=habit.id, completed_at=now_utc)
    db.add(new_log)

    # 2. Streak (ardışık gün sayısı) hesapla
    if habit.last_completed_at is None:
        habit.streak_count = 1
    else:
        last_completed_date = habit.last_completed_at.date()
        date_diff = (today_date - last_completed_date).days

        if date_diff == 1:
            # Dün tamamlanmış, seriyi devam ettir
            habit.streak_count += 1
        elif date_diff > 1:
            # Seri kırılmış, sıfırla ve 1 yap
            habit.streak_count = 1
        # date_diff == 0 durumu yukarıdaki kontrol ile engellendi

    habit.last_completed_at = now_utc

    # 3. Oyunlaştırma (Gamification) - Ödüller
    # Alışkanlık tamamlamak kullanıcıya 15 XP verir
    xp_reward = 15
    current_user.total_xp += xp_reward
    # Seviye atlama (Her 500 XP bir seviye)
    current_user.level = (current_user.total_xp // 500) + 1

    # Sorumluluk skorunu artır (Maksimum 100 olacak şekilde +1.5 puan)
    current_user.responsibility_score = min(100.0, current_user.responsibility_score + 1.5)

    db.commit()
    db.refresh(habit)
    return habit
