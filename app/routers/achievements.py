"""
Gamification & Rozet (Achievement) API endpoint'leri.

Endpoints:
    POST /api/achievements/check -> Kullanıcının rozet hak edip etmediğini kontrol et
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.focus_session import Achievement, AchievementType, FocusSession, Reflection
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/achievements", tags=["Gamification"])


@router.post("/check")
def check_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kullanıcının mevcut istatistiklerini kontrol edip rozet/başarım kazandırır.
    
    Kontrol edilen rozetler:
    - 5 Gün Streak
    - 100 Dk Odaklanma
    - İlk Yansıma (Reflection)
    """
    new_achievements = []
    
    # Mevcut başarımları al (Aynı rozeti tekrar vermemek için)
    existing = db.query(Achievement.name).filter(Achievement.user_id == current_user.id).all()
    existing_names = [a[0] for a in existing]
    
    # 1. 5 Gün Streak Rozeti
    if "5 Gün Serisi!" not in existing_names and current_user.streak_count >= 5:
        ach_streak = Achievement(
            user_id=current_user.id,
            type=AchievementType.STREAK,
            name="5 Gün Serisi!",
            description="Peş peşe 5 gün boyunca hedeflerine ulaştın.",
            xp_earned=50
        )
        db.add(ach_streak)
        new_achievements.append(ach_streak)
        current_user.total_xp += 50
    
    # 2. 100 Dk Odaklanma Rozeti
    if "Derin Odaklanma" not in existing_names:
        total_focus = db.query(func.coalesce(func.sum(FocusSession.duration_minutes), 0))\
                        .filter(FocusSession.user_id == current_user.id).scalar()
        if total_focus >= 100:
            ach_focus = Achievement(
                user_id=current_user.id,
                type=AchievementType.BADGE,
                name="Derin Odaklanma",
                description="Toplamda 100 dakika odaklanma süresini aştın.",
                xp_earned=100
            )
            db.add(ach_focus)
            new_achievements.append(ach_focus)
            current_user.total_xp += 100
            
    # 3. İlk Yansıma Rozeti
    if "İçsel Yolculuk" not in existing_names:
        reflection_count = db.query(func.count(Reflection.id))\
                             .filter(Reflection.user_id == current_user.id).scalar()
        if reflection_count >= 1:
            ach_ref = Achievement(
                user_id=current_user.id,
                type=AchievementType.CHALLENGE,
                name="İçsel Yolculuk",
                description="İlk günlük yansımanı tamamladın.",
                xp_earned=30
            )
            db.add(ach_ref)
            new_achievements.append(ach_ref)
            current_user.total_xp += 30

    if new_achievements:
        db.commit()
        
    return {
        "message": f"{len(new_achievements)} yeni rozet kazanıldı." if new_achievements else "Yeni rozet yok.",
        "new_achievements": [
            {"name": a.name, "description": a.description, "xp": a.xp_earned} 
            for a in new_achievements
        ]
    }
