import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, JSON, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    """Kullanıcı tablosu."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    username: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(500), nullable=True)

    # Kullanıcı tercihleri (tema, bildirim ayarları vb.)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)

    # AI'ın öğrendiği kullanıcı profili (hedefler, çalışma saatleri, alışkanlıklar)
    ai_profile: Mapped[dict] = mapped_column(JSON, default=dict)

    # Gamification
    total_xp: Mapped[int] = mapped_column(default=0)
    level: Mapped[int] = mapped_column(default=1)
    streak_count: Mapped[int] = mapped_column(default=0)
    responsibility_score: Mapped[float] = mapped_column(default=50.0)

    # Zaman damgaları
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_active: Mapped[bool] = mapped_column(default=True)

