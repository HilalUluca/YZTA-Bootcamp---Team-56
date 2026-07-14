import uuid
from datetime import datetime, timezone, date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.habit import Habit, HabitLog, HabitFrequency, HabitCategory
from app.schemas.habit import (
    HabitCreate,
    HabitUpdate,
    HabitResponse,
    HabitListResponse,
    HabitLogResponse,
    HabitCheckInRequest,
    HabitTodayResponse,
    HabitStatsResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/habits", tags=["Aliskanliklar"])


@router.post("/", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
def create_habit(
    habit_data: HabitCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Yeni bir alışkanlık oluşturur (JIRA YZTA-103)."""
    new_habit = Habit(
        user_id=current_user.id,
        title=habit_data.title,
        description=habit_data.description,
        frequency=habit_data.frequency,
        category=habit_data.category,
        target_value=habit_data.target_value,
        unit=habit_data.unit,
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
    """Giriş yapmış kullanıcının alışkanlıklarını listeler (JIRA YZTA-103)."""
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


@router.get("/today", response_model=list[HabitTodayResponse])
def get_today_habits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının bugünkü alışkanlıklarını ve tamamlanma durumlarını listeler (JIRA YZTA-104)."""
    habits = (
        db.query(Habit)
        .filter(Habit.user_id == current_user.id)
        .order_by(desc(Habit.created_at))
        .all()
    )

    today_date = datetime.now(timezone.utc).date()
    today_habits = []

    for habit in habits:
        is_completed = any(log.completed_at.date() == today_date for log in habit.logs)
        today_habits.append(
            HabitTodayResponse(
                id=habit.id,
                title=habit.title,
                description=habit.description,
                frequency=habit.frequency,
                category=habit.category,
                target_value=habit.target_value,
                unit=habit.unit,
                streak_count=habit.streak_count,
                is_completed_today=is_completed,
                last_completed_at=habit.last_completed_at,
                created_at=habit.created_at,
            )
        )

    return today_habits


@router.get("/stats", response_model=HabitStatsResponse)
def get_habit_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının alışkanlık tamamlama istatistiklerini hesaplar ve döner (JIRA YZTA-104)."""
    habits = (
        db.query(Habit)
        .filter(Habit.user_id == current_user.id)
        .all()
    )

    total_habits = len(habits)
    if total_habits == 0:
        return HabitStatsResponse(
            total_habits=0,
            completed_today_count=0,
            completion_rate_today=0.0,
            longest_streak=0,
        )

    today_date = datetime.now(timezone.utc).date()
    completed_today_count = 0
    longest_streak = 0

    for habit in habits:
        is_completed = any(log.completed_at.date() == today_date for log in habit.logs)
        if is_completed:
            completed_today_count += 1
        if habit.streak_count > longest_streak:
            longest_streak = habit.streak_count

    completion_rate = round((completed_today_count / total_habits) * 100, 2)

    return HabitStatsResponse(
        total_habits=total_habits,
        completed_today_count=completed_today_count,
        completion_rate_today=completion_rate,
        longest_streak=longest_streak,
    )


@router.post("/check-in", response_model=HabitResponse)
def check_in_habit(
    request_data: HabitCheckInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bir alışkanlığı bugün için tamamlandı (check-in) olarak işaretler (JIRA YZTA-104)."""
    habit = (
        db.query(Habit)
        .filter(Habit.id == request_data.habit_id, Habit.user_id == current_user.id)
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
    for log in habit.logs:
        if log.completed_at.date() == today_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu alışkanlık bugün zaten tamamlanmış.",
            )

    # 1. Tamamlama log kaydını ekle
    new_log = HabitLog(habit_id=habit.id, completed_at=now_utc)
    db.add(new_log)

    # 2. Streak (seri) hesapla
    if habit.last_completed_at is None:
        habit.streak_count = 1
    else:
        last_completed_date = habit.last_completed_at.date()
        date_diff = (today_date - last_completed_date).days

        if date_diff == 1:
            # Seriyi devam ettir
            habit.streak_count += 1
        elif date_diff > 1:
            # Seri kırılmış, sıfırla
            habit.streak_count = 1

    habit.last_completed_at = now_utc

    # 3. Oyunlaştırma (Gamification) - Ödüller
    xp_reward = 15
    current_user.total_xp += xp_reward
    current_user.level = (current_user.total_xp // 500) + 1

    # Sorumluluk skorunu artır (Maksimum 100 olacak şekilde +1.5 puan)
    current_user.responsibility_score = min(100.0, current_user.responsibility_score + 1.5)

    db.commit()
    db.refresh(habit)
    return habit


@router.get("/{habit_id}", response_model=HabitResponse)
def get_habit(
    habit_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tek bir alışkanlığın detayını getirir (JIRA YZTA-103)."""
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
    """Belirli bir alışkanlığı günceller (JIRA YZTA-103)."""
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
    if habit_data.category is not None:
        habit.category = habit_data.category
    if habit_data.target_value is not None:
        habit.target_value = habit_data.target_value
    if habit_data.unit is not None:
        habit.unit = habit_data.unit

    db.commit()
    db.refresh(habit)
    return habit


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Belirli bir alışkanlığı siler (JIRA YZTA-103)."""
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
