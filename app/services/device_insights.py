"""
Cihaz kullanım verisinden içgörü üretimi — YZTA-151.

Buradaki her şey DETERMİNİSTİK ve kural tabanlıdır: hangi saatin boşa gittiği,
ne kadar zamanın geri kazanılabileceği gibi sayılar veriden hesaplanır, LLM'e
sorulmaz. LLM yalnızca öneri cümlelerini insanileştirmek için (opsiyonel olarak,
`app/agents/device_insight_agent.py` üzerinden) devreye girer; erişilemezse
buradaki kural tabanlı cümleler kullanılır.

Sebep: "14:00-15:30 arası 90 dakika" gibi bir sayı yanlış olamaz — bunu üreten
şey ölçülebilir olmalı. Öneri metni ise üslup meselesi, orada LLM değer katar.
"""

from datetime import date as date_type, datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from app.models.device import DeviceUsage
from app.models.task import Task, TaskPriority, TaskStatus


# --- Uygulama sınıflandırması -------------------------------------------------

# Dikkat dağıtıcı sayılan uygulamalar. Buraya girmeyen her uygulama NÖTR kabul
# edilir ve "boşa giden zaman" hesabına katılmaz — yani chrome, spotify gibi
# bağlama göre değişen uygulamalar kullanıcıyı haksız yere suçlamaz.
DISTRACTING_APPS: set[str] = {
    "instagram",
    "tiktok",
    "youtube",
    "twitter",
    "x",
    "snapchat",
    "facebook",
    "reddit",
    "netflix",
    "twitch",
    "pinterest",
    "tinder",
    "whatsapp",
    "telegram",
    "discord",
}

# Arayüzde düzgün görünsün diye özel yazımlar; listede olmayan isim Title Case olur.
_DISPLAY_NAMES: Dict[str, str] = {
    "youtube": "YouTube",
    "tiktok": "TikTok",
    "x": "X (Twitter)",
    "twitter": "X (Twitter)",
    "whatsapp": "WhatsApp",
    "vscode": "VS Code",
}

# Bir saatte bu kadar dakikadan az dikkat dağıtıcı kullanım varsa "boşa gitti"
# demiyoruz — 10 dakikalık bir mola israf değildir.
WASTED_HOUR_THRESHOLD_MIN = 30

# Tespit edilen boş zamanın gerçekçi olarak ne kadarı geri kazanılabilir?
# Tamamı değil: insan molasız çalışmaz. Yarısı iyimser ama savunulabilir bir hedef.
RECOVERY_FACTOR = 0.5

# İçgörü varsayılan olarak son kaç güne bakar.
DEFAULT_WINDOW_DAYS = 7


def normalize_app(name: str) -> str:
    """Uygulama adını karşılaştırma için sadeleştirir."""
    return (name or "").strip().lower()


def display_app(name: str) -> str:
    """Uygulama adını kullanıcıya gösterilecek hale getirir."""
    key = normalize_app(name)
    return _DISPLAY_NAMES.get(key, key.title() if key else "Bilinmeyen")


def is_distracting(name: str) -> bool:
    return normalize_app(name) in DISTRACTING_APPS


# --- Veri toplama -------------------------------------------------------------

def get_entries(
    db: Session, user_id, days: int = DEFAULT_WINDOW_DAYS
) -> List[DeviceUsage]:
    """Son `days` güne ait kayıtları yeniden eskiye döner."""
    since = datetime.now(timezone.utc).date() - timedelta(days=days - 1)
    return (
        db.query(DeviceUsage)
        .filter(DeviceUsage.user_id == user_id, DeviceUsage.date >= since)
        .order_by(DeviceUsage.date.desc())
        .all()
    )


def _hourly_distraction_profile(
    entries: Iterable[DeviceUsage],
) -> tuple[Dict[int, float], Dict[int, Dict[str, float]], int]:
    """
    Pencere boyunca saat bazlı ORTALAMA dikkat dağıtıcı kullanım profilini çıkarır.

    Tek güne değil ortalamaya bakıyoruz: amaç "dün 15:00'te canın sıkıldı"
    demek değil, "her gün 15:00 civarı kaybediyorsun" alışkanlığını yakalamak.

    Returns:
        (saat -> ortalama dakika, saat -> uygulama -> ortalama dakika, veri olan gün sayısı)
    """
    totals: Dict[int, float] = {}
    per_app: Dict[int, Dict[str, float]] = {}
    days_with_data = 0

    for entry in entries:
        hourly = entry.hourly_usage or {}
        if not hourly:
            continue
        days_with_data += 1
        for hour_key, apps in hourly.items():
            try:
                hour = int(hour_key)
            except (TypeError, ValueError):
                continue
            for app_name, minutes in (apps or {}).items():
                if not is_distracting(app_name):
                    continue
                value = float(minutes or 0)
                if value <= 0:
                    continue
                totals[hour] = totals.get(hour, 0.0) + value
                bucket = per_app.setdefault(hour, {})
                key = normalize_app(app_name)
                bucket[key] = bucket.get(key, 0.0) + value

    if days_with_data == 0:
        return {}, {}, 0

    avg_totals = {h: v / days_with_data for h, v in totals.items()}
    avg_per_app = {
        h: {a: m / days_with_data for a, m in apps.items()} for h, apps in per_app.items()
    }
    return avg_totals, avg_per_app, days_with_data


def _format_clock(minutes_from_midnight: float) -> str:
    """Gece yarısından itibaren dakikayı 'HH:MM'e çevirir (24:00'ı aşmaz)."""
    total = int(round(min(minutes_from_midnight, 24 * 60)))
    return f"{total // 60:02d}:{total % 60:02d}"


def find_wasted_slots(
    avg_totals: Dict[int, float], avg_per_app: Dict[int, Dict[str, float]]
) -> List[dict]:
    """
    Eşiği aşan saatleri bulup bitişik olanları tek bloğa birleştirir.

    Blok başlangıcı ilk saatin başı; süresi o bloktaki dikkat dağıtıcı
    dakikaların toplamı; bitiş = başlangıç + süre. Yani 14. saatte 55 dk,
    15. saatte 35 dk varsa sonuç '14:00-15:30 / 90 dk' olur.
    """
    hot_hours = sorted(h for h, m in avg_totals.items() if m >= WASTED_HOUR_THRESHOLD_MIN)
    if not hot_hours:
        return []

    slots: List[dict] = []
    block: List[int] = [hot_hours[0]]

    def close(current: List[int]) -> None:
        duration = sum(avg_totals[h] for h in current)
        apps: Dict[str, float] = {}
        for h in current:
            for app_name, minutes in avg_per_app.get(h, {}).items():
                apps[app_name] = apps.get(app_name, 0.0) + minutes
        ranked = sorted(apps.items(), key=lambda kv: kv[1], reverse=True)
        start_minutes = current[0] * 60
        slots.append(
            {
                "time": f"{_format_clock(start_minutes)}-{_format_clock(start_minutes + duration)}",
                "apps": [display_app(a) for a, _ in ranked],
                "duration_min": int(round(duration)),
                "start_hour": current[0],
            }
        )

    for hour in hot_hours[1:]:
        if hour == block[-1] + 1:
            block.append(hour)
        else:
            close(block)
            block = [hour]
    close(block)

    # En çok zaman kaybedilen blok başa gelsin.
    slots.sort(key=lambda s: s["duration_min"], reverse=True)
    return slots


# --- Öneri üretimi (kural tabanlı) -------------------------------------------

def _avg(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def build_rule_recommendations(
    slots: List[dict], entries: List[DeviceUsage]
) -> List[str]:
    """
    Veriye dayalı, Türkçe öneri cümleleri. LLM erişilemediğinde de anlamlı
    bir çıktı olması için tek başına yeterli olacak şekilde yazıldı.
    """
    recommendations: List[str] = []

    for slot in slots[:2]:
        apps = ", ".join(slot["apps"][:2]) or "dikkat dağıtan uygulamalar"
        recommendations.append(
            f"{slot['time']} arası {apps} yerine odaklanma seansı koy — "
            f"günde {slot['duration_min']} dakika kazanırsın."
        )

    # Geç saatte ekran → uyku kalitesi
    late_slot = next((s for s in slots if s["start_hour"] >= 20), None)
    if late_slot:
        recommendations.append(
            "20:00'dan sonra ekranı 30 dk ile sınırla, uyku kaliten artar."
        )

    sleep_values = [e.sleep_hours for e in entries if e.sleep_hours and e.sleep_hours > 0]
    if sleep_values:
        avg_sleep = _avg(sleep_values)
        if avg_sleep < 7:
            recommendations.append(
                f"Ortalama uykun {avg_sleep:.1f} saat. 7 saatin altında odaklanma "
                "süresi belirgin düşer; yatma saatini 30 dk öne çek."
            )

    step_values = [e.step_count for e in entries if e.step_count]
    if step_values:
        avg_steps = _avg([float(s) for s in step_values])
        if avg_steps < 5000:
            recommendations.append(
                f"Günlük adımın ortalama {int(avg_steps)}. Seanslar arasına 10 dk "
                "yürüyüş koyarsan hem adım hem zihin tazeliği kazanırsın."
            )

    if not recommendations:
        recommendations.append(
            "Belirgin bir zaman kaybı görünmüyor — mevcut düzenini koru."
        )

    return recommendations


# --- Otomatik plan önerisi ----------------------------------------------------

def get_open_tasks(db: Session, user_id, limit: int) -> List[Task]:
    """Kullanıcının açık görevleri, Eisenhower önceliğine göre sıralı."""
    priority_rank = {
        TaskPriority.URGENT_IMPORTANT: 0,
        TaskPriority.IMPORTANT: 1,
        TaskPriority.URGENT: 2,
        TaskPriority.LOW: 3,
    }
    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user_id,
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
        )
        .all()
    )
    tasks.sort(key=lambda t: (priority_rank.get(t.priority, 4), t.created_at or datetime.min))
    return tasks[:limit]


def _busy_hours(entry: Optional[DeviceUsage]) -> set[int]:
    """Takvimde etkinlik olan saatler — üzerine plan yazmayalım."""
    busy: set[int] = set()
    if entry is None:
        return busy
    for event in entry.calendar_events or []:
        try:
            start = int(str(event.get("start", "")).split(":")[0])
            end_parts = str(event.get("end", "")).split(":")
            end_hour = int(end_parts[0])
            end_minute = int(end_parts[1]) if len(end_parts) > 1 else 0
        except (AttributeError, ValueError, IndexError):
            continue
        # Bitiş dakikası 0 ise o saat serbesttir (10:00'da biten etkinlik 10'u kapatmaz).
        last = end_hour if end_minute > 0 else end_hour - 1
        for hour in range(start, last + 1):
            busy.add(hour)
    return busy


def build_auto_plan(
    db: Session,
    user_id,
    slots: List[dict],
    latest_entry: Optional[DeviceUsage] = None,
    max_tasks: int = 3,
) -> dict:
    """
    Boşa giden saatlere kullanıcının GERÇEK açık görevlerini yerleştirir.

    Görev uydurmuyoruz: listede ne varsa o planlanır. Açık görev yoksa
    yalnızca odak seansı önerilir.
    """
    busy = _busy_hours(latest_entry)
    usable = [s for s in slots if s["start_hour"] not in busy]

    tasks = get_open_tasks(db, user_id, max_tasks)

    tasks_to_schedule: List[str] = []
    focus_sessions: List[dict] = []

    for index, slot in enumerate(usable[:max_tasks]):
        start_clock = f"{slot['start_hour']:02d}:00"

        if index < len(tasks):
            tasks_to_schedule.append(f"{tasks[index].title} → {start_clock}")

        # 25 dakikalık bloklar; slot süresinin kaldırabileceği kadar, en fazla 4.
        count = max(1, min(4, int(slot["duration_min"] // 30)))
        focus_sessions.append(
            {"start": start_clock, "type": "pomodoro_25", "count": count}
        )

    return {
        "tasks_to_schedule": tasks_to_schedule,
        "focus_sessions": focus_sessions,
        "slots_used": usable[:max_tasks],
    }


# --- Ana giriş noktası --------------------------------------------------------

def build_insights(
    db: Session, user_id, days: int = DEFAULT_WINDOW_DAYS, max_tasks: int = 3
) -> dict:
    """
    Pencere boyunca cihaz verisini analiz edip içgörü paketini üretir.

    `ai_recommendations` burada kural tabanlı doldurulur; router isterse
    LLM çıktısıyla değiştirir.
    """
    entries = get_entries(db, user_id, days)
    avg_totals, avg_per_app, days_with_data = _hourly_distraction_profile(entries)
    slots = find_wasted_slots(avg_totals, avg_per_app)

    daily_wasted = sum(avg_totals.values())
    slot_minutes_per_day = sum(s["duration_min"] for s in slots)
    recoverable_weekly = slot_minutes_per_day * 7 / 60 * RECOVERY_FACTOR

    latest_entry = entries[0] if entries else None
    plan = build_auto_plan(db, user_id, slots, latest_entry, max_tasks)

    return {
        "wasted_slots": [
            {"time": s["time"], "apps": s["apps"], "duration_min": s["duration_min"]}
            for s in slots
        ],
        "recoverable_hours_weekly": round(recoverable_weekly, 1),
        "ai_recommendations": build_rule_recommendations(slots, entries),
        "auto_plan_suggestion": {
            "tasks_to_schedule": plan["tasks_to_schedule"],
            "focus_sessions": plan["focus_sessions"],
        },
        "analysis_window_days": days,
        "days_with_data": days_with_data,
        "daily_wasted_minutes_avg": round(daily_wasted, 1),
        "recommendations_source": "rules",
        # Router'ın auto-plan'de yeniden hesaplamaması için taşınıyor (spec dışı).
        "_slots_used": plan["slots_used"],
    }
