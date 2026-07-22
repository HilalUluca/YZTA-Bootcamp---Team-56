"""
Gunluk Yansima API endpoint'leri.

Endpoints:
    POST   /api/reflections/         -> Gunluk yansima ekle
    GET    /api/reflections/         -> Yansimalari listele
    GET    /api/reflections/{id}     -> Tek yansima getir
    POST   /api/reflections/analyze  -> Son 7 yansımanın duygu trendi analizi
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
from app.agents.reflection_agent import analyze_sentiment

router = APIRouter(prefix="/api/reflections", tags=["Gunluk Yansima"])


@router.get("/today", response_model=ReflectionResponse)
def get_today_reflection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının bugün yaptığı check-in/yansıma kaydını getirir."""
    today_date = datetime.now(timezone.utc).date()
    today_start = datetime.combine(today_date, datetime.min.time(), tzinfo=timezone.utc)
    today_end = datetime.combine(today_date, datetime.max.time(), tzinfo=timezone.utc)

    reflection = (
        db.query(Reflection)
        .filter(
            Reflection.user_id == current_user.id,
            Reflection.date >= today_start,
            Reflection.date <= today_end,
        )
        .first()
    )

    if not reflection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bugün henüz check-in/yansıma yapılmamış.",
        )

    return reflection


@router.post("/", response_model=ReflectionResponse, status_code=status.HTTP_201_CREATED)
def create_reflection(
    reflection_data: ReflectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Günlük check-in / yansıma ekler veya günceller (Upsert).

    Sabah check-in'inde mood ve energy_level girilebilir.
    Akşam yansımasında ise wins, improvements ve gratitude eklenerek güncellenir.
    """
    today_date = datetime.now(timezone.utc).date()
    today_start = datetime.combine(today_date, datetime.min.time(), tzinfo=timezone.utc)
    today_end = datetime.combine(today_date, datetime.max.time(), tzinfo=timezone.utc)

    reflection = (
        db.query(Reflection)
        .filter(
            Reflection.user_id == current_user.id,
            Reflection.date >= today_start,
            Reflection.date <= today_end,
        )
        .first()
    )

    text_to_analyze = " ".join(filter(None, [
        reflection_data.wins, 
        reflection_data.improvements, 
        reflection_data.gratitude
    ]))
    sentiment = analyze_sentiment(text_to_analyze)

    if not reflection:
        # Yeni kayıt oluşturuluyor
        reflection = Reflection(
            user_id=current_user.id,
            date=datetime.now(timezone.utc),
            mood=reflection_data.mood,
            energy_level=reflection_data.energy_level,
            wins=reflection_data.wins,
            improvements=reflection_data.improvements,
            gratitude=reflection_data.gratitude,
            ai_analysis={"sentiment": sentiment},
        )
        # Yeni kayıt için XP ödülü
        xp_bonus = 25
        current_user.total_xp += xp_bonus
        current_user.level = (current_user.total_xp // 500) + 1
        db.add(reflection)
    else:
        # Var olan kayıt güncelleniyor (Check-in üzerine yansıma ekleme)
        reflection.mood = reflection_data.mood
        reflection.energy_level = reflection_data.energy_level
        if reflection_data.wins is not None:
            reflection.wins = reflection_data.wins
        if reflection_data.improvements is not None:
            reflection.improvements = reflection_data.improvements
        if reflection_data.gratitude is not None:
            reflection.gratitude = reflection_data.gratitude
        
        # ai_analysis dictini SQLAlchemy de tespit edebilsin diye yeni bir kopyasını atıyoruz
        current_ai = reflection.ai_analysis or {}
        current_ai["sentiment"] = sentiment
        reflection.ai_analysis = dict(current_ai)

    db.commit()
    db.refresh(reflection)
    return reflection


@router.put("/today", response_model=ReflectionResponse)
def update_today_reflection(
    reflection_data: ReflectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bugünün check-in/yansıma kaydını günceller (POST ile aynı upsert mantığını çalıştırır)."""
    return create_reflection(reflection_data, current_user, db)


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


@router.post("/analyze")
def analyze_reflections(
    days: int = Query(default=7, ge=1, le=30, description="Kaç günlük yansıma analiz edilsin"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Son N günün yansımalarını AI'ya gönderip duygu trendi analizi döndürür.

    Döndürdüğü veriler:
    - mood_trend: Son günlerdeki ruh hali trendi
    - energy_trend: Enerji seviyesi trendi  
    - sentiment_summary: Genel duygu özeti
    - insights: AI'ın tespit ettiği kalıplar
    - recommendation: Kişisel öneri
    """
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)

    reflections = (
        db.query(Reflection)
        .filter(Reflection.user_id == current_user.id, Reflection.date >= since)
        .order_by(desc(Reflection.date))
        .all()
    )

    if not reflections:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Son {days} günde yansıma bulunamadı. Önce günlük yansıma ekleyin.",
        )

    # Verileri topla
    mood_data = []
    energy_data = []
    texts = []

    for r in reflections:
        mood_map = {"great": 5, "good": 4, "neutral": 3, "low": 2, "bad": 1}
        mood_val = mood_map.get(r.mood.value if hasattr(r.mood, 'value') else r.mood, 3)
        mood_data.append({"date": str(r.date.date() if r.date else ""), "value": mood_val, "label": r.mood.value if hasattr(r.mood, 'value') else r.mood})
        energy_data.append({"date": str(r.date.date() if r.date else ""), "value": r.energy_level})

        parts = [r.wins, r.improvements, r.gratitude]
        text = " ".join([p for p in parts if p])
        if text:
            texts.append(text)

    # Basit istatistikler
    avg_mood = sum(d["value"] for d in mood_data) / len(mood_data) if mood_data else 3
    avg_energy = sum(d["value"] for d in energy_data) / len(energy_data) if energy_data else 3

    # Trend hesapla (ilk yarı vs ikinci yarı)
    mid = len(mood_data) // 2
    if mid > 0:
        first_half_mood = sum(d["value"] for d in mood_data[mid:]) / len(mood_data[mid:])
        second_half_mood = sum(d["value"] for d in mood_data[:mid]) / len(mood_data[:mid])
        mood_direction = "yükseliyor" if second_half_mood > first_half_mood else ("düşüyor" if second_half_mood < first_half_mood else "sabit")
    else:
        mood_direction = "yetersiz veri"

    # AI analizi (varsa)
    ai_insight = None
    try:
        combined_text = f"Son {days} günlük yansımalar: " + " | ".join(texts[:5])
        ai_insight = analyze_sentiment(combined_text)
    except Exception:
        ai_insight = "AI analizi şu an kullanılamıyor."

    return {
        "period": f"Son {days} gün",
        "total_reflections": len(reflections),
        "mood_trend": {
            "average": round(avg_mood, 2),
            "direction": mood_direction,
            "data": mood_data,
        },
        "energy_trend": {
            "average": round(avg_energy, 2),
            "data": energy_data,
        },
        "sentiment_summary": ai_insight,
        "recommendation": (
            "Harika gidiyorsun! Bu tempoyu koru." if avg_mood >= 4
            else "İyi bir seviyedesin, küçük iyileştirmelerle daha da yükselebilirsin." if avg_mood >= 3
            else "Zor bir dönemden geçiyor olabilirsin. Küçük adımlarla başla, kendine zaman tanı."
        ),
    }
