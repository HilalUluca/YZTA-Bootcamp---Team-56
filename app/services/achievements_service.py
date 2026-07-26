"""
Rozet / başarım (achievement) sistemi (YZTA-120).

Rozet kataloğu ve değerlendirme mantığı tek yerde toplanır; hem otomatik
tetikleme (görev/seans/yansıma tamamlandığında) hem manuel `POST /check` hem de
`GET /achievements/` listesi bu kaynağı kullanır.

Rozetler bir kez verilir (kullanıcı başına isimle tekilleştirilir) ve kazanılınca
kullanıcıya XP eklenir. Mevcut veritabanındaki rozet isimleriyle uyumlu kalması
için isimler korunmuştur.
"""

import logging
from typing import Callable

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.models.focus_session import (
    Achievement,
    AchievementType,
    FocusSession,
    Reflection,
)
from app.models.task import Task, TaskStatus
from app.services.streak_service import calculate_streak

logger = logging.getLogger(__name__)


def _total_focus_minutes(db: Session, user_id) -> int:
    return (
        db.query(func.coalesce(func.sum(FocusSession.duration_minutes), 0))
        .filter(FocusSession.user_id == user_id, FocusSession.end_time.isnot(None))
        .scalar()
    )


def _focus_session_count(db: Session, user_id) -> int:
    return (
        db.query(func.count(FocusSession.id))
        .filter(FocusSession.user_id == user_id, FocusSession.end_time.isnot(None))
        .scalar()
    )


def _reflection_count(db: Session, user_id) -> int:
    return (
        db.query(func.count(Reflection.id))
        .filter(Reflection.user_id == user_id)
        .scalar()
    )


def _completed_task_count(db: Session, user_id) -> int:
    return (
        db.query(func.count(Task.id))
        .filter(Task.user_id == user_id, Task.status == TaskStatus.DONE)
        .scalar()
    )


# Rozet kataloğu. `condition` bir (db, user) -> bool fonksiyonudur.
# Yeni rozet eklemek için buraya bir satır eklemek yeterli.
BADGES: list[dict] = [
    {
        "key": "first_focus",
        "name": "İlk Odak Seansı",
        "description": "İlk odaklanma seansını tamamladın.",
        "type": AchievementType.BADGE,
        "xp": 20,
        "condition": lambda db, u: _focus_session_count(db, u.id) >= 1,
    },
    {
        "key": "deep_focus",
        "name": "Derin Odaklanma",
        "description": "Toplamda 100 dakika odaklanma süresini aştın.",
        "type": AchievementType.BADGE,
        "xp": 100,
        "condition": lambda db, u: _total_focus_minutes(db, u.id) >= 100,
    },
    {
        "key": "first_reflection",
        "name": "İçsel Yolculuk",
        "description": "İlk günlük yansımanı tamamladın.",
        "type": AchievementType.CHALLENGE,
        "xp": 30,
        "condition": lambda db, u: _reflection_count(db, u.id) >= 1,
    },
    {
        "key": "streak_5",
        "name": "5 Gün Serisi!",
        "description": "Peş peşe 5 gün boyunca hedeflerine ulaştın.",
        "type": AchievementType.STREAK,
        "xp": 50,
        "condition": lambda db, u: calculate_streak(db, u.id) >= 5,
    },
    {
        "key": "task_hunter",
        "name": "Görev Avcısı",
        "description": "Toplam 10 görevi tamamladın.",
        "type": AchievementType.BADGE,
        "xp": 40,
        "condition": lambda db, u: _completed_task_count(db, u.id) >= 10,
    },
]


def evaluate_and_award(db: Session, user: User) -> list[Achievement]:
    """
    Kullanıcının hak ettiği ama henüz almadığı rozetleri verir.

    Idempotent: aynı rozet iki kez verilmez. Yeni rozet varsa XP eklenir ve
    değişiklikler commit edilir. Yeni rozet yoksa yazma yapılmaz.
    """
    existing_names = {
        name
        for (name,) in db.query(Achievement.name).filter(Achievement.user_id == user.id).all()
    }

    newly_awarded: list[Achievement] = []
    for badge in BADGES:
        if badge["name"] in existing_names:
            continue
        condition: Callable[[Session, User], bool] = badge["condition"]
        try:
            if not condition(db, user):
                continue
        except Exception as exc:  # noqa: BLE001 - tek rozet hatası diğerlerini engellemesin
            logger.error("Rozet koşulu değerlendirilemedi (%s): %s", badge["key"], exc)
            continue

        achievement = Achievement(
            user_id=user.id,
            type=badge["type"],
            name=badge["name"],
            description=badge["description"],
            xp_earned=badge["xp"],
            metadata_json={"key": badge["key"]},
        )
        db.add(achievement)
        user.total_xp += badge["xp"]
        newly_awarded.append(achievement)

    if newly_awarded:
        # XP arttıysa seviye de güncellensin (backend formülü: her 500 XP = 1 seviye)
        user.level = (user.total_xp // 500) + 1
        db.commit()
        for achievement in newly_awarded:
            db.refresh(achievement)

    return newly_awarded


def try_evaluate(db: Session, user: User) -> list[Achievement]:
    """
    Otomatik tetikleme için güvenli sarmalayıcı: rozet değerlendirmesi bir
    tamamlanma akışını (görev/seans/yansıma) asla bozmamalı.
    """
    try:
        return evaluate_and_award(db, user)
    except Exception as exc:  # noqa: BLE001
        logger.error("Otomatik rozet değerlendirmesi başarısız (user=%s): %s", user.id, exc)
        db.rollback()
        return []
