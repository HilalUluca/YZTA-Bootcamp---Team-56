"""
Gunluk Yansima API endpoint'leri.

Endpoints:
    POST   /api/reflections/    -> Gunluk yansima ekle
    GET    /api/reflections/    -> Yansimalari listele
    GET    /api/reflections/{id} -> Tek yansima getir
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.focus_session import Reflection
from app.schemas.reflection import (
    ReflectionCreate,
    ReflectionResponse,
    ReflectionListResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/reflections", tags=["Gunluk Yansima"])


@router.post("/", response_model=ReflectionResponse, status_code=status.HTTP_201_CREATED)
def create_reflection(
    reflection_data: ReflectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Gunluk yansima ekler.

    Her gun sonunda kullanici:
    - Ruh halini secer (great/good/neutral/low/bad)
    - Enerji seviyesini belirtir (1-5)
    - Neler iyi gitti, yarin ne degisir yazar
    """
    new_reflection = Reflection(
        user_id=current_user.id,
        date=datetime.now(timezone.utc),
        mood=reflection_data.mood,
        energy_level=reflection_data.energy_level,
        wins=reflection_data.wins,
        improvements=reflection_data.improvements,
        gratitude=reflection_data.gratitude,
        ai_analysis={},
    )

    # Yansima yapan kullaniciya XP ver
    xp_bonus = 25
    current_user.total_xp += xp_bonus
    current_user.level = (current_user.total_xp // 500) + 1

    db.add(new_reflection)
    db.commit()
    db.refresh(new_reflection)

    return new_reflection


@router.get("/", response_model=ReflectionListResponse)
def list_reflections(
    limit: int = Query(default=14, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanicinin gunluk yansimalarini listeler (en yeniler basta)."""
    reflections = (
        db.query(Reflection)
        .filter(Reflection.user_id == current_user.id)
        .order_by(desc(Reflection.date))
        .limit(limit)
        .all()
    )

    return ReflectionListResponse(
        reflections=reflections,
        total=len(reflections),
    )


@router.get("/{reflection_id}", response_model=ReflectionResponse)
def get_reflection(
    reflection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tek bir gunluk yansimayi getirir."""
    reflection = (
        db.query(Reflection)
        .filter(Reflection.id == reflection_id, Reflection.user_id == current_user.id)
        .first()
    )

    if not reflection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Yansima bulunamadi",
        )

    return reflection
