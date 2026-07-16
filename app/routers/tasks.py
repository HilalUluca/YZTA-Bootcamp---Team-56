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


# ============================================================================
# AI DESTEKLI GOREV YONETIMI (YZTA-70, YZTA-71)
# ============================================================================

from pydantic import BaseModel, Field
from typing import List


class PrioritizeRequest(BaseModel):
    """Gorev onceliklendirme istegi. Bos birakilirsa kullanicinin tum gorevleri onceliklendirilir."""
    user_context: Optional[str] = Field(
        None,
        description="Opsiyonel: Kullanicinin duygu durumu veya ek bilgi. Ornek: 'Bugun enerjim dusuk'"
    )


class BreakDownRequest(BaseModel):
    """Gorev parcalama istegi."""
    task_name: str = Field(..., description="Parcalanacak ana gorevin adi")
    task_description: Optional[str] = Field(None, description="Gorevin detayli aciklamasi")
    estimated_time: Optional[int] = Field(None, description="Tahmini toplam sure (dakika)")


@router.post("/prioritize")
async def prioritize_user_tasks(
    request: PrioritizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kullanicinin mevcut gorevlerini AI ile Eisenhower matrisine gore onceliklendirir.

    - Tum acik gorevleri veritabanindan ceker
    - Gemini API ile analiz eder
    - Her goreve oncelik skoru ve kategori atar
    """
    from app.agents.ai_planner_agent import prioritize_tasks

    # Kullanicinin acik gorevlerini al
    tasks = (
        db.query(Task)
        .filter(Task.user_id == current_user.id, Task.status != TaskStatus.DONE)
        .all()
    )

    if not tasks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Onceliklendirilecek gorev bulunamadi. Once gorev ekleyin.",
        )

    # Task'leri AI servisinin bekledigi dict formatina cevir
    tasks_for_ai = [
        {
            "title": task.title,
            "description": task.description or "Aciklama yok",
            "deadline": task.due_date.isoformat() if task.due_date else "Belirlenmemis",
            "estimated_duration": task.estimated_minutes or 30,
        }
        for task in tasks
    ]

    try:
        result = await prioritize_tasks(
            tasks=tasks_for_ai,
            user_context=request.user_context,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI servisi yapilandirma hatasi: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gorev onceliklendirme hatasi: {str(e)}",
        )


@router.post("/break-down")
async def break_down_user_task(
    request: BreakDownRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Buyuk ve karmasik bir gorevi mantiksal alt gorevlere boler.

    Ornek: "Web sitesi gelistir" -> 5-8 alt gorev
    Her alt gorev icin tahmini sure ve aciklama doner.
    """
    from app.agents.ai_planner_agent import break_down_task

    try:
        result = await break_down_task(
            task_name=request.task_name,
            task_description=request.task_description,
            estimated_time=request.estimated_time,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI servisi yapilandirma hatasi: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gorev parcalama hatasi: {str(e)}",
        )
