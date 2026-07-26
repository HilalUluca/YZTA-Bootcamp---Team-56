"""
Gamification & Rozet (Achievement) API endpoint'leri.

Endpoints:
    GET  /api/achievements/       -> Kazanılan + katalogdaki tüm rozetleri listele
    POST /api/achievements/check  -> Rozet hak edilip edilmediğini kontrol et ve ver
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.focus_session import Achievement
from app.services.auth import get_current_user
from app.services.achievements_service import BADGES, evaluate_and_award

router = APIRouter(prefix="/api/achievements", tags=["Gamification"])


@router.get("/")
def list_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kullanıcının kazandığı rozetleri ve katalogdaki tüm rozetleri (kilitli/açık
    durumuyla) döner. Profil sayfası bu veriyle rozet ızgarasını çizer.
    """
    earned = (
        db.query(Achievement)
        .filter(Achievement.user_id == current_user.id)
        .order_by(Achievement.earned_at.desc())
        .all()
    )
    earned_by_name = {a.name: a for a in earned}

    catalog = []
    for badge in BADGES:
        owned = earned_by_name.get(badge["name"])
        catalog.append({
            "key": badge["key"],
            "name": badge["name"],
            "description": badge["description"],
            "type": badge["type"].value,
            "xp": badge["xp"],
            "earned": owned is not None,
            "earned_at": owned.earned_at.isoformat() if owned else None,
        })

    return {
        "earned": [
            {
                "name": a.name,
                "description": a.description,
                "type": a.type.value,
                "xp": a.xp_earned,
                "earned_at": a.earned_at.isoformat() if a.earned_at else None,
            }
            for a in earned
        ],
        "catalog": catalog,
        "total_earned": len(earned),
        "total_badges": len(BADGES),
    }


@router.post("/check")
def check_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kullanıcının mevcut istatistiklerini kontrol edip hak edilen rozetleri verir.

    Katalog ve koşullar `achievements_service` içinde tanımlıdır. Rozetler
    tamamlanma anlarında (görev/seans/yansıma) otomatik de verilir; bu endpoint
    manuel/telafi kontrolü içindir.
    """
    new_achievements = evaluate_and_award(db, current_user)

    return {
        "message": (
            f"{len(new_achievements)} yeni rozet kazanıldı."
            if new_achievements
            else "Yeni rozet yok."
        ),
        "new_achievements": [
            {"name": a.name, "description": a.description, "xp": a.xp_earned}
            for a in new_achievements
        ],
    }
