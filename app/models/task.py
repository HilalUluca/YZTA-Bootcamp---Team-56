import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Integer, Float, JSON, Uuid, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskPriority(str, enum.Enum):
    """Eisenhower matrisine göre görev önceliği."""
    URGENT_IMPORTANT = "urgent_important"      # Acil ve Önemli → Hemen yap
    IMPORTANT = "important"                     # Önemli ama acil değil → Planla
    URGENT = "urgent"                           # Acil ama önemli değil → Delege et
    LOW = "low"                                 # Ne acil ne önemli → Elemeyi düşün


class TaskStatus(str, enum.Enum):
    """Görev durumu."""
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class Task(Base):
    """Görev tablosu."""

    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Öncelik ve durum
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority), default=TaskPriority.LOW
    )
    ai_priority_score: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.TODO
    )

    # Zaman bilgileri
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    actual_minutes: Mapped[int] = mapped_column(Integer, nullable=True)

    # Alt görev desteği (görev parçalama için)
    parent_task_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True
    )

    # Etiketler
    tags: Mapped[dict] = mapped_column(JSON, default=list)

    # Zaman damgaları
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # İlişkiler
    subtasks = relationship("Task", backref="parent_task", remote_side="Task.id")
