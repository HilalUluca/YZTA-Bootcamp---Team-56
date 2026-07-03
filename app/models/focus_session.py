import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Integer, Float, JSON, Uuid, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SessionType(str, enum.Enum):
    """Odaklanma seansı türü."""
    POMODORO_25 = "pomodoro_25"   # 25 dk çalış / 5 dk mola
    POMODORO_50 = "pomodoro_50"   # 50 dk çalış / 10 dk mola
    CUSTOM = "custom"              # Kullanıcı tanımlı süre


class FocusSession(Base):
    """Odaklanma seansı tablosu."""

    __tablename__ = "focus_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )

    # Seans bilgileri
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    session_type: Mapped[SessionType] = mapped_column(
        Enum(SessionType), default=SessionType.POMODORO_25
    )

    # Kullanıcı değerlendirmesi
    productivity_rating: Mapped[int] = mapped_column(Integer, nullable=True)  # 1-5
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    interruption_count: Mapped[int] = mapped_column(Integer, default=0)

    # Zaman damgası
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MoodLevel(str, enum.Enum):
    """Ruh hali seviyeleri."""
    GREAT = "great"
    GOOD = "good"
    NEUTRAL = "neutral"
    LOW = "low"
    BAD = "bad"


class Reflection(Base):
    """Günlük yansıma tablosu."""

    __tablename__ = "reflections"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Yansıma verileri
    mood: Mapped[MoodLevel] = mapped_column(Enum(MoodLevel), nullable=False)
    energy_level: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    wins: Mapped[str] = mapped_column(Text, nullable=True)
    improvements: Mapped[str] = mapped_column(Text, nullable=True)
    gratitude: Mapped[str] = mapped_column(Text, nullable=True)

    # AI analizi
    ai_analysis: Mapped[dict] = mapped_column(JSON, default=dict)

    # Zaman damgası
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AchievementType(str, enum.Enum):
    """Başarım türleri."""
    STREAK = "streak"
    LEVEL_UP = "level_up"
    BADGE = "badge"
    CHALLENGE = "challenge"


class Achievement(Base):
    """Başarımlar ve rozetler tablosu."""

    __tablename__ = "achievements"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[AchievementType] = mapped_column(Enum(AchievementType), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class DailyStats(Base):
    """Günlük istatistik tablosu (snapshot)."""

    __tablename__ = "daily_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    tasks_completed: Mapped[int] = mapped_column(Integer, default=0)
    tasks_created: Mapped[int] = mapped_column(Integer, default=0)
    focus_minutes: Mapped[int] = mapped_column(Integer, default=0)
    streak_count: Mapped[int] = mapped_column(Integer, default=0)
    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    responsibility_score: Mapped[float] = mapped_column(Float, default=50.0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
