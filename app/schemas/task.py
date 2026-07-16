"""Görev API şemaları (request/response)."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.task import TaskPriority, TaskStatus


# --- Kullanıcı Bağlamı (AI Token Optimizasyonu İçin) ---

class UserContext(BaseModel):
    """AI işlemlerinde token tasarrufu sağlamak için minimal kullanıcı durumu."""
    mood: Optional[str] = Field(default=None, description="Anlık ruh hali (örn: stresli, yorgun, enerjik)")
    energy: Optional[int] = Field(default=None, ge=1, le=10, description="1-10 arası anlık enerji seviyesi")
    persona: Optional[str] = Field(default=None, description="Ajanın bürüneceği mizaç (örn: disiplinli, motive edici, stratejik)")


# --- Görev Oluşturma ---

class TaskCreate(BaseModel):
    """Yeni görev oluşturma isteği."""
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    priority: Optional[TaskPriority] = TaskPriority.LOW
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    parent_task_id: Optional[uuid.UUID] = None
    tags: Optional[list[str]] = None
    user_context: Optional[UserContext] = None  # YZTA-93: AI mizaç ve enerji yönetimi için eklendi


# --- Görev Güncelleme ---

class TaskUpdate(BaseModel):
    """Görev güncelleme isteği. Sadece gönderilen alanlar güncellenir."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    tags: Optional[list[str]] = None
    user_context: Optional[UserContext] = None


# --- Görev Yanıtı ---

class TaskResponse(BaseModel):
    """API'den dönen görev bilgisi."""
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str] = None
    priority: TaskPriority
    ai_priority_score: float = 0.0
    status: TaskStatus
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    parent_task_id: Optional[uuid.UUID] = None
    tags: list = []
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Görev Listesi ---

class TaskListResponse(BaseModel):
    """Görev listesi yanıtı."""
    tasks: list[TaskResponse]
    total: int