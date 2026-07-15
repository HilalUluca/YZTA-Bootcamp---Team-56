"""Görev API şemaları (request/response)."""

import uuid
from datetime import datetime
from typing import Optional, List

# pyright: reportMissingImports=false

from pydantic import BaseModel, Field
from app.models.task import TaskPriority, TaskStatus

# --- Context Modeli (Tüm ajanlar için ortak dil) ---

class UserContext(BaseModel):
    """
    Token tasarrufu sağlayan, ajanlar arası veri taşıma modeli.
    """
    mood: str = Field(..., description="Anlık ruh hali")
    energy_level: int = Field(..., ge=1, le=5, description="1-5 arası enerji")
    persona: str = Field("stratejist", description="AI yanıt tonu")
    profile_snippet: str | None = None   # "[PROFILE] identity: hayvansever | ..."

# --- Görev Oluşturma ---

class TaskCreate(BaseModel):
    """Yeni görev oluşturma isteği."""
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    priority: Optional[TaskPriority] = TaskPriority.LOW
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    parent_task_id: Optional[uuid.UUID] = None
    tags: Optional[List[str]] = None


# --- Görev Güncelleme ---

class TaskUpdate(BaseModel):
    """Görev güncelleme isteği."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    tags: Optional[List[str]] = None


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
    tags: List[str] = []
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Görev Listesi ---

class TaskListResponse(BaseModel):
    """Görev listesi yanıtı."""
    tasks: List[TaskResponse]
    total: int