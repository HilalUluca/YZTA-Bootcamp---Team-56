"""
Demo kullanıcısı için 30 günlük gerçekçi veri üretir — YZTA-149.

Üretilenler:
    - 30 günlük görev geçmişi (zamanında biten, geç biten, kaçırılan, açık)
    - 20+ odaklanma seansı (farklı saatler, farklı verimlilik puanları)
    - 14 günlük yansıma (mood eğrisi: düşük → yükselen)
    - Alışkanlık logları (biri kesintisiz seri, biri kırık seri)
    - Rozet kazanımları
    - (Bonus) 14 günlük cihaz kullanım verisi — YZTA-151 uçlarını beslesin diye

Kullanım:
    python scripts/seed_demo_data.py --reset
    python scripts/seed_demo_data.py --email demo@example.com --days 30

Tasarım notları:
    * ÜRETİLEN VERİ TUTARLIDIR: XP, seviye, seri ve sorumluluk skoru elle
      yazılmaz; uygulamanın kendi kurallarıyla (focus XP = süre × verimlilik,
      yansıma +25, alışkanlık +15) hesaplanır. Böylece demo profili API'nin
      döndüğü değerlerle çelişmez.
    * ROZETLER GERÇEK MOTORDAN GEÇER: `evaluate_and_award` çağrılır, rozet
      satırları elle uydurulmaz. Bu yüzden rozetlerin `earned_at` tarihi
      script'in çalıştığı andır — koşulun geçmişte sağlandığı an değil.
    * TEKRAR ÇALIŞTIRILABİLİR: `--reset` ile kullanıcının mevcut demo verisi
      silinip yeniden üretilir. `--reset` olmadan üstüne yazar (veri çoğalır),
      bu yüzden normalde --reset ile çalıştırın.
    * DETERMİNİSTİK: aynı --seed aynı veriyi üretir.
"""

from __future__ import annotations

import argparse
import logging
import random
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

# Script doğrudan çalıştırıldığında (python scripts/seed_demo_data.py) proje
# kökü sys.path'te olmaz; ekliyoruz ki "app" paketi import edilebilsin.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Türkçe karakterler Windows konsolunda bozulmasın.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.database import SessionLocal, engine, Base  # noqa: E402
from app.models.device import DeviceUsage  # noqa: E402
from app.models.focus_session import (  # noqa: E402
    Achievement,
    FocusSession,
    MoodLevel,
    Reflection,
    SessionType,
)
from app.models.habit import Habit, HabitCategory, HabitFrequency, HabitLog  # noqa: E402
from app.models.task import Task, TaskPriority, TaskStatus  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.achievements_service import evaluate_and_award  # noqa: E402
from app.services.auth import hash_password  # noqa: E402
from app.services.gamification import calculate_responsibility_score  # noqa: E402
from app.services.streak_service import calculate_streak  # noqa: E402

# Ayarlarda debug=True iken engine echo=True ile kuruluyor ve her SQL sorgusunu
# basıyor; binlerce satır arasında script'in özeti kayboluyor. Bu bir CLI aracı,
# SQL dökümüne ihtiyacı yok. Engine import sırasında kurulduğu için susturmayı
# import'lardan SONRA yapmak zorundayız — öncesinde yapılırsa create_engine
# logger seviyesini tekrar INFO'ya çeker.
engine.echo = False
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


# --- Uygulamanın kendi XP kuralları (tek doğruluk kaynağı burada tekrarlanmaz,
#     ilgili router'lardaki değerlerle birebir aynı tutulur) ---
XP_PER_REFLECTION = 25   # app/routers/reflections.py
XP_PER_HABIT_LOG = 15    # app/routers/habits.py
XP_PER_LEVEL = 500       # her yerde: level = total_xp // 500 + 1


# --- Görev havuzu -------------------------------------------------------------

TASK_POOL: list[tuple[str, str, TaskPriority, int]] = [
    ("Veri yapıları çalış", "Ağaçlar ve graf algoritmaları", TaskPriority.IMPORTANT, 90),
    ("SQL ödevini bitir", "Join sorguları ve alt sorgular", TaskPriority.URGENT_IMPORTANT, 60),
    ("Bootcamp sunumu hazırla", "Beş slaytlık akış çıkar", TaskPriority.IMPORTANT, 45),
    ("Sprint retrospektifi yaz", "Takım notlarını derle", TaskPriority.URGENT, 25),
    ("Makale oku", "Deep Work — 3. bölüm", TaskPriority.LOW, 30),
    ("Kod review yap", "Açık iki PR'ı incele", TaskPriority.URGENT, 40),
    ("Portfolyo sitesini güncelle", "Yeni projeyi ekle", TaskPriority.LOW, 75),
    ("Algoritma sorusu çöz", "Günün LeetCode sorusu", TaskPriority.IMPORTANT, 35),
    ("Haftalık planı çıkar", "Pazartesi sabahı için", TaskPriority.IMPORTANT, 20),
    ("İngilizce kelime tekrarı", "Anki destesini bitir", TaskPriority.LOW, 20),
    ("Backend testlerini düzelt", "Kırık iki testi yeşile al", TaskPriority.URGENT_IMPORTANT, 80),
    ("Mentor görüşmesi notları", "Toplantı öncesi hazırlan", TaskPriority.URGENT, 15),
    ("Figma tasarımını incele", "Yeni ekran akışı", TaskPriority.LOW, 30),
    ("Dokümantasyon yaz", "Kurulum adımlarını güncelle", TaskPriority.IMPORTANT, 50),
]

# Görevin akıbeti ve göreli sıklığı. "Kaçırılan" görevler demo için önemli:
# sorumluluk skoru ve gecikmiş sayacı ancak böyle anlamlı görünür.
OUTCOMES = [
    ("done_on_time", 45),
    ("done_late", 15),
    ("missed", 15),
    ("open", 25),
]

# Kaçırılmış görevler yalnızca son bu kadar gün içinde açık bırakılır.
#
# Neden: `calculate_responsibility_score` gecikmiş görevleri zaman penceresi
# OLMADAN sayar — deadline'ı geçmiş her açık görev kalıcı olarak -10 puan.
# 30 günün tamamına yayılan kaçırılmış görevler demo kullanıcıyı 16/100 ile
# "poor" seviyesine düşürüyordu; bu ne gerçekçi ne de yükselen mood eğrisiyle
# tutarlı. Daha eski kaçırmalar "geç de olsa tamamlandı"ya çevriliyor (insan
# eski işi ya yapar ya düşürür, aylarca gecikmiş bırakmaz).
STALE_MISS_DAYS = 12

# --- Yansıma metinleri --------------------------------------------------------

WINS = [
    "Sabah ilk işi erteleme olmadan bitirdim.",
    "Telefonu başka odaya koyunca 50 dakika kesintisiz çalıştım.",
    "Zor görevi küçük parçalara bölünce başlamak kolaylaştı.",
    "Bugün planladığım her şeyi bitiremedim ama en önemlisini bitirdim.",
    "Akşam ekran süresini kısıp erken yattım.",
]

IMPROVEMENTS = [
    "Öğleden sonra sosyal medyada çok vakit kaybettim.",
    "Görev listesini çok uzun tuttum, bitiremeyince moralim bozuldu.",
    "Molalarda telefona bakmak yerine yürüyebilirdim.",
    "Sabah rutinine geç başladım, bütün gün geriden geldim.",
    "Tek seferde iki iş yapmaya çalıştım, ikisi de yarım kaldı.",
]

GRATITUDE = [
    "Sessiz bir çalışma ortamım olduğu için minnettarım.",
    "Takım arkadaşımın yardımı işi hızlandırdı.",
    "Bugün hava güzeldi, yürüyüş iyi geldi.",
    "Küçük de olsa ilerleme kaydettim.",
    "Kendime karşı biraz daha sabırlı olabildim.",
]

# 14 günlük mood eğrisi (eskiden yeniye): düşükten yükselene.
MOOD_CURVE: list[tuple[MoodLevel, int]] = [
    (MoodLevel.BAD, 1),
    (MoodLevel.BAD, 2),
    (MoodLevel.LOW, 2),
    (MoodLevel.LOW, 2),
    (MoodLevel.LOW, 3),
    (MoodLevel.NEUTRAL, 3),
    (MoodLevel.NEUTRAL, 3),
    (MoodLevel.NEUTRAL, 4),
    (MoodLevel.GOOD, 4),
    (MoodLevel.GOOD, 4),
    (MoodLevel.GOOD, 5),
    (MoodLevel.GREAT, 4),
    (MoodLevel.GOOD, 5),
    (MoodLevel.GREAT, 5),
]

# --- Cihaz verisi (YZTA-151 uçlarını beslemek için) --------------------------

# Her gün tekrarlayan dikkat dağınıklığı kalıbı: öğleden sonra ve gece.
# `/api/device/insights` bu kalıptan 14:00 ve 21:00 bloklarını çıkarabilmeli.
DISTRACTION_PATTERN: dict[int, dict[str, int]] = {
    9: {"whatsapp": 8},
    12: {"instagram": 18},
    14: {"youtube": 32, "tiktok": 20},
    15: {"tiktok": 25, "instagram": 12},
    18: {"instagram": 15},
    21: {"twitter": 35, "youtube": 25},
    22: {"twitter": 28},
}

PRODUCTIVE_APPS_PATTERN: dict[int, dict[str, int]] = {
    10: {"chrome": 40},
    11: {"vscode": 45},
    16: {"chrome": 30},
}


def utc(day: date, hour: int = 12, minute: int = 0) -> datetime:
    """Bir günün belirli saatini timezone-aware UTC datetime olarak verir."""
    return datetime.combine(day, time(hour=hour, minute=minute), tzinfo=timezone.utc)


def today_hours_before(now: datetime, wanted: list[int], count: int) -> list[int]:
    """
    Bugün için, şu andan ÖNCE kalan saatlerden en fazla `count` tane seçer.

    Neden gerekli: bugünün verisi geçmişte olmalı — script sabah 08:00'de
    çalıştığında 16:00'da biten bir odak seansı üretmek anlamsız olur.
    Erken saatte çalıştırılırsa (henüz uygun saat yoksa) günün başına düşer.
    """
    available = [h for h in wanted if h <= now.hour]
    if not available:
        # Gece yarısı civarı: mevcut saati kullan, en azından "bugün" içinde kalsın.
        available = [now.hour]
    return available[-count:]


# --- Kullanıcı ----------------------------------------------------------------

def get_or_create_user(db, email: str, username: str, password: str, full_name: str) -> tuple[User, bool]:
    """Demo kullanıcısını bulur, yoksa oluşturur."""
    user = db.query(User).filter(User.email == email).first()
    if user:
        # Kullanıcı zaten varsa CLI argümanları kazanır; aksi halde --full-name
        # veya --password vermek ikinci çalıştırmada hiçbir işe yaramaz.
        user.full_name = full_name
        user.username = username
        user.hashed_password = hash_password(password)
        db.commit()
        db.refresh(user)
        return user, False

    user = User(
        email=email,
        username=username,
        hashed_password=hash_password(password),
        full_name=full_name,
        # Onboarding akışı demo kullanıcıyı karşılamasın diye tamamlanmış sayıyoruz.
        # (Bayrak ai_profile içinden türetiliyor — bkz. app/schemas/user.py)
        ai_profile={"onboarding_completed": True},
        total_xp=0,
        level=1,
        streak_count=0,
        responsibility_score=50.0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, True


def purge_user_data(db, user: User) -> dict[str, int]:
    """Kullanıcının üretilmiş tüm verisini siler (kullanıcının kendisi kalır)."""
    counts: dict[str, int] = {}

    habit_ids = [h.id for h in db.query(Habit).filter(Habit.user_id == user.id).all()]
    if habit_ids:
        counts["habit_logs"] = (
            db.query(HabitLog)
            .filter(HabitLog.habit_id.in_(habit_ids))
            .delete(synchronize_session=False)
        )
    counts["habits"] = (
        db.query(Habit).filter(Habit.user_id == user.id).delete(synchronize_session=False)
    )
    counts["tasks"] = (
        db.query(Task).filter(Task.user_id == user.id).delete(synchronize_session=False)
    )
    counts["focus_sessions"] = (
        db.query(FocusSession)
        .filter(FocusSession.user_id == user.id)
        .delete(synchronize_session=False)
    )
    counts["reflections"] = (
        db.query(Reflection)
        .filter(Reflection.user_id == user.id)
        .delete(synchronize_session=False)
    )
    counts["achievements"] = (
        db.query(Achievement)
        .filter(Achievement.user_id == user.id)
        .delete(synchronize_session=False)
    )
    counts["device_usage"] = (
        db.query(DeviceUsage)
        .filter(DeviceUsage.user_id == user.id)
        .delete(synchronize_session=False)
    )

    user.total_xp = 0
    user.level = 1
    user.streak_count = 0
    user.responsibility_score = 50.0
    db.commit()
    return counts


# --- Üreticiler ---------------------------------------------------------------

def seed_tasks(
    db, user: User, rng: random.Random, days: int, today: date, now: datetime
) -> dict[str, int]:
    """Gün gün görev geçmişi üretir (bugün dahil)."""
    stats = {"done_on_time": 0, "done_late": 0, "missed": 0, "open": 0}
    outcomes, weights = zip(*OUTCOMES)

    # Havuz 30 güne yayıldığı için başlıklar tekrar ediyor. Tamamlanmış
    # görevlerde bu sorun değil (geçmişte aynı işi birden çok kez yapmış
    # olabilir), ama AÇIK görevler listede ve otomatik planda yan yana
    # görüneceği için tekrarlı başlık demoyu bozuk gösteriyor.
    open_titles: set[str] = set()

    for offset in range(days, 0, -1):
        day = today - timedelta(days=offset)
        for _ in range(rng.choice([1, 1, 2, 2, 3])):
            title, description, priority, estimated = rng.choice(TASK_POOL)
            created = utc(day, rng.randint(8, 11), rng.choice([0, 15, 30, 45]))
            due = utc(day, rng.randint(17, 22))

            # Son 2 günde "kaçırılmış" demek erken; onları açık bırakıyoruz.
            outcome = "open" if offset <= 2 else rng.choices(outcomes, weights=weights, k=1)[0]

            # Eski kaçırmalar sonunda tamamlanmış sayılır (bkz. STALE_MISS_DAYS).
            if outcome == "missed" and offset > STALE_MISS_DAYS:
                outcome = "done_late"

            # Açık kalacak görevlerde başlık tekrarını önle: havuzdan kullanılmamış
            # bir başlık ara, hepsi tükendiyse bu görevi tamamlanmışa çevir.
            if outcome in ("open", "missed"):
                if title in open_titles:
                    alternatives = [t for t in TASK_POOL if t[0] not in open_titles]
                    if alternatives:
                        title, description, priority, estimated = rng.choice(alternatives)
                    else:
                        outcome = "done_on_time"
                if outcome in ("open", "missed"):
                    open_titles.add(title)

            task = Task(
                user_id=user.id,
                title=title,
                description=description,
                priority=priority,
                estimated_minutes=estimated,
                created_at=created,
                updated_at=created,
                due_date=due,
                tags=[],
            )

            if outcome == "done_on_time":
                task.status = TaskStatus.DONE
                task.completed_at = due - timedelta(minutes=rng.randint(20, 240))
                task.actual_minutes = max(5, estimated + rng.randint(-15, 25))
            elif outcome == "done_late":
                task.status = TaskStatus.DONE
                task.completed_at = due + timedelta(hours=rng.randint(2, 30))
                task.actual_minutes = max(5, estimated + rng.randint(0, 45))
            elif outcome == "missed":
                # Tamamlanmadı ve deadline geçti → "gecikmiş" sayacına düşer.
                task.status = TaskStatus.TODO
            else:  # open
                task.status = TaskStatus.TODO
                # Açık görevlerin deadline'ı ileri tarihte olsun ki gecikmiş görünmesin.
                task.due_date = utc(today + timedelta(days=rng.randint(1, 5)), rng.randint(17, 21))

            db.add(task)
            stats[outcome] += 1

    # --- BUGÜN ---
    # Ayrı ele alınıyor çünkü bugünün şekli farklı: gün bitmediği için
    # "kaçırılmış" görev olamaz, ama ana sayfadaki "Tamamlanan Görev" sayacının
    # 0 görünmemesi için birkaç görev bugün tamamlanmış olmalı.
    done_today = 2
    for index in range(done_today + 2):
        title, description, priority, estimated = rng.choice(TASK_POOL)
        created = now - timedelta(hours=rng.randint(3, 8))
        # Gün başından öncesine taşmasın (script gece yarısı çalışırsa)
        created = max(created, utc(today, 0, 5))

        if index < done_today:
            # Bugün tamamlananlar — başlık tekrarı sorun değil, listede görünmezler.
            task = Task(
                user_id=user.id,
                title=title,
                description=description,
                priority=priority,
                estimated_minutes=estimated,
                created_at=created,
                updated_at=created,
                due_date=utc(today, 21),
                status=TaskStatus.DONE,
                completed_at=now - timedelta(minutes=rng.randint(15, 150)),
                actual_minutes=max(5, estimated + rng.randint(-10, 20)),
                tags=[],
            )
            stats["done_on_time"] += 1
        else:
            # Bugün açık kalanlar — başlıkları benzersiz olmalı.
            alternatives = [t for t in TASK_POOL if t[0] not in open_titles]
            if not alternatives:
                continue
            title, description, priority, estimated = rng.choice(alternatives)
            open_titles.add(title)
            task = Task(
                user_id=user.id,
                title=title,
                description=description,
                priority=priority,
                estimated_minutes=estimated,
                created_at=created,
                updated_at=created,
                due_date=utc(today, rng.randint(20, 23)),
                status=TaskStatus.TODO,
                tags=[],
            )
            stats["open"] += 1

        db.add(task)

    db.commit()
    return stats


def seed_focus_sessions(
    db, user: User, rng: random.Random, days: int, today: date, now: datetime
) -> tuple[int, int]:
    """
    Odaklanma seansları üretir (bugün dahil). Farklı saatler ve farklı verimlilik
    puanları; verimlilik zaman içinde hafifçe yükselir (kullanıcı toparlanıyor
    hikayesi).

    Returns: (seans sayısı, kazanılan toplam XP)
    """
    # Sabah / öğleden sonra / akşam — hepsinden örnek olsun.
    hours = [8, 9, 10, 11, 14, 15, 16, 17, 20, 21, 22]
    session_types = [
        (SessionType.POMODORO_25, 25),
        (SessionType.POMODORO_25, 25),
        (SessionType.POMODORO_50, 50),
        (SessionType.CUSTOM, 15),
        (SessionType.CUSTOM, 40),
        (SessionType.CUSTOM, 90),
    ]

    count = 0
    total_xp = 0

    for offset in range(days, 0, -1):
        day = today - timedelta(days=offset)
        # Günlerin ~%70'inde seans var; son haftada biraz daha sık.
        chance = 0.85 if offset <= 7 else 0.65
        if rng.random() > chance:
            continue

        for _ in range(rng.choice([1, 1, 2])):
            hour = rng.choice(hours)
            session_type, duration = rng.choice(session_types)
            start = utc(day, hour, rng.choice([0, 10, 20, 30]))

            # Verimlilik: eskiden yeniye doğru artan taban + gürültü.
            progress = (days - offset) / max(days - 1, 1)
            base = 2.0 + progress * 2.0            # 2.0 → 4.0
            rating = int(round(min(5, max(1, base + rng.uniform(-0.8, 0.9)))))

            db.add(
                FocusSession(
                    user_id=user.id,
                    start_time=start,
                    end_time=start + timedelta(minutes=duration),
                    duration_minutes=duration,
                    session_type=session_type,
                    productivity_rating=rating,
                    interruption_count=rng.choice([0, 0, 1, 2]),
                    notes=None,
                    # created_at streak ve skor sorgularında kullanılıyor;
                    # backdate etmezsek bütün seanslar "bugün" sayılır.
                    created_at=start,
                )
            )
            # app/routers/focus.py ile aynı formül
            total_xp += duration * rating
            count += 1

    # --- BUGÜN ---
    # Ana sayfadaki "Bugün Odaklanma" 0 dk görünmesin diye bugüne de seans
    # koyuyoruz. Saatler şu andan önce seçiliyor; ileri tarihli seans olmaz.
    for hour in today_hours_before(now, [9, 11, 14, 16], count=2):
        session_type, duration = rng.choice(session_types[:3])  # 25/25/50 dk
        start = utc(today, hour, rng.choice([0, 10, 20]))
        if start + timedelta(minutes=duration) > now:
            # Seans şu ana taşıyorsa geriye kaydır ki bitmiş bir seans olsun.
            start = max(utc(today, 0, 0), now - timedelta(minutes=duration + 5))

        rating = rng.choice([4, 4, 5])  # bugün iyi gidiyor
        db.add(
            FocusSession(
                user_id=user.id,
                start_time=start,
                end_time=start + timedelta(minutes=duration),
                duration_minutes=duration,
                session_type=session_type,
                productivity_rating=rating,
                interruption_count=rng.choice([0, 0, 1]),
                notes=None,
                created_at=start,
            )
        )
        total_xp += duration * rating
        count += 1

    db.commit()
    return count, total_xp


def seed_reflections(db, user: User, rng: random.Random, today: date) -> tuple[int, int]:
    """14 günlük yansıma; mood eğrisi düşükten yükseğe."""
    count = 0
    for index, (mood, energy) in enumerate(MOOD_CURVE):
        # index 0 = en eski gün
        offset = len(MOOD_CURVE) - index
        day = today - timedelta(days=offset)
        moment = utc(day, 22, rng.choice([0, 15, 30]))

        db.add(
            Reflection(
                user_id=user.id,
                date=moment,
                mood=mood,
                energy_level=energy,
                wins=rng.choice(WINS),
                improvements=rng.choice(IMPROVEMENTS),
                gratitude=rng.choice(GRATITUDE),
                ai_analysis={},
                created_at=moment,
            )
        )
        count += 1

    db.commit()
    return count, count * XP_PER_REFLECTION


def seed_habits(
    db, user: User, rng: random.Random, today: date, now: datetime
) -> tuple[int, int]:
    """
    Üç alışkanlık ve logları.

    Biri kesintisiz (güçlü seri), biri neredeyse kusursuz, biri kırık seri —
    streak göstergesinin hem dolu hem sıfır halini demoda görebilmek için.
    """
    specs = [
        {
            "title": "Sabah 30 sayfa kitap oku",
            "description": "Güne ekranla değil kitapla başla.",
            "category": HabitCategory.GROWTH,
            "target_value": 30,
            "unit": "sayfa",
            # Bugün dahil son 10 gün kesintisiz
            "log_offsets": list(range(0, 10)),
        },
        {
            "title": "Günde 2 litre su iç",
            "description": "Sabah, öğle ve akşam birer şişe.",
            "category": HabitCategory.MUST_DO,
            "target_value": 2,
            "unit": "litre",
            # Bugün dahil son 15 gün, biri atlanmış
            "log_offsets": [d for d in range(0, 15) if d != 6],
        },
        {
            "title": "Akşam 20 dk yürüyüş",
            "description": "Ekrandan uzaklaş, kısa tur at.",
            "category": HabitCategory.GROWTH,
            "target_value": 20,
            "unit": "dakika",
            # Kırık seri: son 3 gün yok
            "log_offsets": [4, 5, 6, 8, 9, 11, 12],
        },
    ]

    total_logs = 0

    for spec in specs:
        created = utc(today - timedelta(days=20), 9)
        habit = Habit(
            user_id=user.id,
            title=spec["title"],
            description=spec["description"],
            frequency=HabitFrequency.DAILY,
            category=spec["category"],
            target_value=spec["target_value"],
            unit=spec["unit"],
            created_at=created,
        )
        db.add(habit)
        db.flush()  # habit.id gerekiyor

        offsets = sorted(spec["log_offsets"])
        for offset in offsets:
            moment = utc(today - timedelta(days=offset), rng.randint(7, 21))
            # Bugünün logu ileri saate düşmesin (gün henüz bitmedi).
            moment = min(moment, now)
            db.add(HabitLog(habit_id=habit.id, completed_at=moment))
            total_logs += 1

        # streak_count'u loglardan türet: en son log gününden geriye doğru
        # kaç gün kesintisiz gidiyor?
        log_days = {today - timedelta(days=o) for o in offsets}
        streak = 0
        cursor = max(log_days) if log_days else None
        while cursor and cursor in log_days:
            streak += 1
            cursor -= timedelta(days=1)

        habit.streak_count = streak
        habit.last_completed_at = min(utc(max(log_days), 20), now) if log_days else None

    db.commit()
    return len(specs), total_logs


def seed_device_usage(
    db, user: User, rng: random.Random, today: date, now: datetime, days: int = 14
) -> int:
    """
    Cihaz kullanım verisi (YZTA-151). Her gün aynı kalıbın gürültülü hali;
    böylece `/api/device/insights` tekrar eden boşa giden saatleri yakalayabilir.
    """
    count = 0
    # 0 = bugün. Bugünün verisi de olsun ki "bugün senkronlandı" hissi versin;
    # henüz geçmemiş saatler doğal olarak boş kalır.
    for offset in range(0, days):
        day = today - timedelta(days=offset)
        is_today = offset == 0

        hourly: dict[str, dict[str, float]] = {}
        breakdown: dict[str, float] = {}

        for hour, apps in {**DISTRACTION_PATTERN, **PRODUCTIVE_APPS_PATTERN}.items():
            # Bugün için henüz gelmemiş saatleri doldurma.
            if is_today and hour > now.hour:
                continue
            bucket: dict[str, float] = {}
            for app_name, minutes in apps.items():
                # ±%30 gürültü, saat başına 60 dakikayı aşmasın
                noisy = max(0, min(60, round(minutes * rng.uniform(0.7, 1.3))))
                if noisy == 0:
                    continue
                bucket[app_name] = noisy
                breakdown[app_name] = round(breakdown.get(app_name, 0.0) + noisy / 60, 2)
            # Saat toplamı 60'ı aşarsa orantılı kırp
            total = sum(bucket.values())
            if total > 60:
                bucket = {a: round(m * 60 / total) for a, m in bucket.items()}
            if bucket:
                hourly[str(hour)] = bucket

        screen_time = round(sum(sum(b.values()) for b in hourly.values()) / 60, 2)

        events = []
        if day.weekday() < 5:  # hafta içi
            events.append({"title": "Bootcamp dersi", "start": "13:00", "end": "14:00"})
        if day.weekday() == 2:
            events.append({"title": "Mentor görüşmesi", "start": "19:00", "end": "19:30"})

        db.add(
            DeviceUsage(
                user_id=user.id,
                date=day,
                screen_time_hours=screen_time,
                screen_time_breakdown=breakdown,
                hourly_usage=hourly,
                step_count=rng.randint(2200, 9500),
                sleep_hours=round(rng.uniform(5.2, 7.8), 1),
                calendar_events=events,
            )
        )
        count += 1

    db.commit()
    return count


# --- Ana akış -----------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="FocusForge demo kullanıcısı için 30 günlük veri üretir (YZTA-149)."
    )
    parser.add_argument("--email", default="demo@example.com")
    parser.add_argument("--username", default="demo")
    parser.add_argument("--password", default="Demo12345")
    parser.add_argument("--full-name", default="Ali")
    parser.add_argument("--days", type=int, default=30, help="Kaç günlük geçmiş üretilsin")
    parser.add_argument("--seed", type=int, default=42, help="Rastgelelik tohumu")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Kullanıcının mevcut verisini silip sıfırdan üret (önerilir)",
    )
    parser.add_argument(
        "--no-device",
        action="store_true",
        help="Cihaz kullanım verisi (YZTA-151) üretme",
    )
    args = parser.parse_args()

    if args.days < 1:
        print("HATA: --days en az 1 olmali.")
        return 1

    rng = random.Random(args.seed)
    now = datetime.now(timezone.utc)
    today = now.date()

    # Tablolar yoksa oluştur (uygulamanın kendi başlangıç davranışıyla aynı).
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        user, created = get_or_create_user(
            db, args.email, args.username, args.password, args.full_name
        )
        print(f"[1/7] Kullanici: {user.username} <{user.email}> "
              f"({'olusturuldu' if created else 'mevcut'})")

        if args.reset:
            counts = purge_user_data(db, user)
            silinen = ", ".join(f"{k}={v}" for k, v in counts.items() if v)
            print(f"[2/7] Mevcut veri silindi ({silinen or 'zaten bostu'})")
        elif not created:
            print("[2/7] UYARI: --reset verilmedi, mevcut verinin ustune yaziliyor.")
        else:
            print("[2/7] Temiz kullanici, silinecek veri yok")

        task_stats = seed_tasks(db, user, rng, args.days, today, now)
        print(f"[3/7] Gorevler: {sum(task_stats.values())} adet "
              f"(zamaninda={task_stats['done_on_time']}, gec={task_stats['done_late']}, "
              f"kacirilan={task_stats['missed']}, acik={task_stats['open']})")

        session_count, focus_xp = seed_focus_sessions(db, user, rng, args.days, today, now)
        print(f"[4/7] Odak seanslari: {session_count} adet, {focus_xp} XP")

        reflection_count, reflection_xp = seed_reflections(db, user, rng, today)
        print(f"[5/7] Yansimalar: {reflection_count} gun (mood: dusuk -> yuksek), "
              f"{reflection_xp} XP")

        habit_count, log_count = seed_habits(db, user, rng, today, now)
        habit_xp = log_count * XP_PER_HABIT_LOG
        print(f"[6/7] Aliskanliklar: {habit_count} adet, {log_count} log, {habit_xp} XP")

        device_count = 0
        if not args.no_device:
            device_count = seed_device_usage(db, user, rng, today, now)

        # --- Türetilmiş alanları uygulamanın kurallarıyla hesapla ---
        user.total_xp = focus_xp + reflection_xp + habit_xp
        user.level = (user.total_xp // XP_PER_LEVEL) + 1
        db.commit()

        # Rozetleri gerçek motordan geçir (XP'yi kendisi ekler, seviyeyi günceller).
        awarded = evaluate_and_award(db, user)

        user.streak_count = calculate_streak(db, user.id)
        score = calculate_responsibility_score(user, db)
        user.responsibility_score = score["score"]
        db.commit()
        db.refresh(user)

        print(f"[7/7] Rozetler: {len(awarded)} adet "
              f"({', '.join(a.name for a in awarded) if awarded else 'yeni rozet yok'})")

        print()
        print("=" * 58)
        print("  DEMO VERISI HAZIR")
        print("=" * 58)
        print(f"  Giris     : {args.username} / {args.password}")
        print(f"  E-posta   : {user.email}")
        print(f"  Toplam XP : {user.total_xp}  (Seviye {user.level})")
        print(f"  Seri      : {user.streak_count} gun")
        print(f"  Skor      : {user.responsibility_score} / 100 ({score['level']})")
        if device_count:
            print(f"  Cihaz     : {device_count} gunluk kullanim verisi")
            print("              -> GET /api/device/insights ile analizi gor")
        print("=" * 58)
        return 0

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
