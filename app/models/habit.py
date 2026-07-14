import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Integer, Uuid, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class HabitFrequency(str, enum.Enum):
    """Alışkanlık tekrarlanma sıklığı."""
    DAILY = "daily"
    WEEKLY = "weekly"


class HabitCategory(str, enum.Enum):
    """Alışkanlık kategorisi."""
    MUST_DO = "must_do"  # Yapılması zorunlu olanlar (öz disiplin)
    GROWTH = "growth"    # Kişisel gelişim hedefleri


class Habit(Base):
    """Alışkanlık tanımlarının tutulduğu tablo."""

    __tablename__ = "habits"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    frequency: Mapped[HabitFrequency] = mapped_column(
        Enum(HabitFrequency), default=HabitFrequency.DAILY
    )
    category: Mapped[HabitCategory] = mapped_column(
        Enum(HabitCategory), default=HabitCategory.GROWTH
    )
    target_value: Mapped[int] = mapped_column(Integer, default=1)  # Örn: 30 sayfa için 30, 1 kez spor için 1
    unit: Mapped[str] = mapped_column(String(100), default="kez")  # Örn: "sayfa", "saat", "dakika", "kez"

    # İlerleme ve Oyunlaştırma Verileri
    streak_count: Mapped[int] = mapped_column(Integer, default=0)
    last_completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Zaman damgası
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # İlişkiler (Alışkanlık silindiğinde logları da silinir)
    logs: Mapped[list["HabitLog"]] = relationship(
        "HabitLog", back_populates="habit", cascade="all, delete-orphan", lazy="selectin"
    )


class HabitLog(Base):
    """Alışkanlıkların günlük tamamlanma geçmişini tutan tablo."""

    __tablename__ = "habit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    habit_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("habits.id", ondelete="CASCADE"), nullable=False
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # İlişkiler
    habit: Mapped[Habit] = relationship("Habit", back_populates="logs")
