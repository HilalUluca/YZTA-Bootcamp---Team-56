"""
Görev Yönetimi API endpoint'leri.

Endpoints:
    POST   /api/tasks          → Yeni görev oluştur
    GET    /api/tasks          → Kullanıcının görevlerini listele
    GET    /api/tasks/{id}     → Tek görev getir
    PUT    /api/tasks/{id}     → Görev güncelle
    DELETE /api/tasks/{id}     → Görev sil
    PATCH  /api/tasks/{id}/complete → Görevi tamamla
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.task import Task, TaskStatus, TaskPriority
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskListResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["Görev Yönetimi"])


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Yeni görev oluşturur.

    Kullanıcı "SQL Ödevi" gibi bir başlık girer,
    opsiyonel olarak açıklama, öncelik, deadline ekleyebilir.
    """
    new_task = Task(
        user_id=current_user.id,
        title=task_data.title,
        description=task_data.description,
        priority=task_data.priority or TaskPriority.LOW,
        due_date=task_data.due_date,
        estimated_minutes=task_data.estimated_minutes,
        parent_task_id=task_data.parent_task_id,
        tags=task_data.tags or [],
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


@router.get("/", response_model=TaskListResponse)
def list_tasks(
    status_filter: Optional[TaskStatus] = Query(default=None, alias="status"),
    priority_filter: Optional[TaskPriority] = Query(default=None, alias="priority"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kullanıcının görevlerini listeler.

    Filtreleme:
        ?status=todo        → Sadece yapılacakları getir
        ?priority=urgent_important → Sadece acil ve önemli olanları getir
    """
    query = db.query(Task).filter(Task.user_id == current_user.id)

    if status_filter:
        query = query.filter(Task.status == status_filter)

    if priority_filter:
        query = query.filter(Task.priority == priority_filter)

    # En yeni görevler üstte
    tasks = query.order_by(desc(Task.created_at)).all()

    return TaskListResponse(tasks=tasks, total=len(tasks))


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tek bir görevi getirir."""
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user.id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Görev bulunamadı",
        )

    return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: uuid.UUID,
    task_data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Görevi günceller. Sadece gönderilen alanlar güncellenir.

    Örnek: {"title": "SQL Ödevi - Güncellendi", "priority": "urgent_important"}
    """
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user.id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Görev bulunamadı",
        )

    # Sadece gönderilen (None olmayan) alanları güncelle
    update_data = task_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    # Eğer durum "done" olarak değiştirildiyse completed_at'i set et
    if task_data.status == TaskStatus.DONE and task.completed_at is None:
        task.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(task)

    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Görevi siler."""
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user.id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Görev bulunamadı",
        )

    db.delete(task)
    db.commit()


@router.patch("/{task_id}/complete", response_model=TaskResponse)
def complete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Görevi tamamlandı olarak işaretler.
    Kısa yol — frontend'den tek tıkla tamamlama için.
    """
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user.id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Görev bulunamadı",
        )

    task.status = TaskStatus.DONE
    task.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(task)

    return task
