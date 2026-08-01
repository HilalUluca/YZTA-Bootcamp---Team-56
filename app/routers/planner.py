"""
AI Planlama & Toplu Gorev API endpoint'leri.

Endpoints:
    POST /api/planner/daily-plan    -> AI ile gunluk plan olustur
    POST /api/planner/bulk-create   -> Toplu gorev olusturma (checklist'ten)
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.task import Task, TaskStatus, TaskPriority
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/planner", tags=["AI Planlama"])


# --- Request/Response Semalari ---

class DailyPlanRequest(BaseModel):
    """Gunluk plan istegi."""
    energy_level: str = Field(
        "medium",
        description="Bugunun enerji seviyesi: low, medium, high"
    )
    available_hours: int = Field(
        8,
        ge=1, le=16,
        description="Bugun kac saat musaitsin"
    )
    user_context: Optional[str] = Field(
        None,
        description="Ek bilgi: 'Bugun toplantim var', 'Sinav haftasi' vs."
    )


class BulkTaskItem(BaseModel):
    """Toplu olusturma icin tek gorev."""
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    estimated_minutes: Optional[int] = None
    priority: Optional[TaskPriority] = TaskPriority.LOW


class BulkCreateRequest(BaseModel):
    """Toplu gorev olusturma istegi (AI parcalama sonrasi)."""
    parent_task_id: Optional[uuid.UUID] = Field(
        None,
        description="Ana gorev ID'si (parcalama sonrasi baglama icin)"
    )
    tasks: List[BulkTaskItem] = Field(
        min_length=1,
        description="Olusturulacak gorevler listesi"
    )


class BulkCreateResponse(BaseModel):
    """Toplu olusturma yaniti."""
    created_count: int
    task_ids: List[str]
    message: str


# --- ENDPOINT'LER ---

@router.post("/daily-plan")
async def create_daily_plan(
    request: DailyPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    AI ile kisisellestirilmis gunluk plan olusturur.

    Kullanicinin acik gorevlerini + enerji seviyesini alir,
    Gemini API ile analiz edip oncelikli plan dondurur.
    """
    from app.agents.ai_planner_agent import get_ai_recommendations

    request_id = str(uuid.uuid4())
    logger.info(f"[DailyPlan] Request {request_id} from user {current_user.id}")

    # Kullanicinin acik gorevlerini al
    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
        )
        .all()
    )

    if not tasks:
        return {
            "message": "Planlanacak gorev bulunamadi. Once gorev ekleyin.",
            "plan": [],
            "summary": "Gorev listeniz bos.",
        }

    # Task'leri AI servisinin bekledigi formata cevir
    tasks_for_ai = [
        {
            "title": task.title,
            "description": task.description or "Aciklama yok",
            "priority": task.priority.value,
            "estimated_duration": task.estimated_minutes or 30,
        }
        for task in tasks
    ]

    # Ek context olustur
    context = f"Enerji seviyesi: {request.energy_level}. Bugun {request.available_hours} saat musait."
    if request.user_context:
        context += f" {request.user_context}"

    try:
        recommendations = await get_ai_recommendations(
            user_tasks=tasks_for_ai,
            user_energy_level=request.energy_level,
            available_time_minutes=request.available_hours * 60,
        )
        return recommendations
    except ValueError as e:
        logger.error(f"[DailyPlan] Req: {request_id} - AI config error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI servisi yapilandirma hatasi: {str(e)}",
        )
    except Exception as e:
        logger.error(f"[DailyPlan] Req: {request_id} - AI call failed: {str(e)}")
        # Fallback plan: Create a simple schedule without AI
        fallback_schedule = []
        assigned_time = 0
        total_time = request.available_hours * 60
        
        # Sort tasks by priority (HIGH=3, MEDIUM=2, LOW=1) and due_date
        def get_prio_val(t):
            if t.priority == TaskPriority.HIGH: return 3
            if t.priority == TaskPriority.MEDIUM: return 2
            return 1

        sorted_tasks = sorted(tasks, key=lambda t: (-get_prio_val(t), t.due_date or datetime.max.replace(tzinfo=timezone.utc)))
        
        for task in sorted_tasks:
            if assigned_time >= total_time:
                break
            duration = task.estimated_minutes or 30
            if assigned_time + duration > total_time:
                duration = total_time - assigned_time
            if duration <= 0:
                continue
                
            fallback_schedule.append({
                "block_type": "task",
                "task_name": task.title,
                "category": task.priority.value,
                "suggested_duration_minutes": duration,
                "priority_score": get_prio_val(task)
            })
            assigned_time += duration
        
        if not fallback_schedule:
             raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Plan olusturulamadi (Req ID: {request_id}). AI servisi yanit vermedi.",
            )

        return {
            "prioritized_tasks": tasks_for_ai,
            "summary": "AI servisine ulaşılamadı. Görevleriniz aciliyet sırasına göre basitçe listelendi.",
            "recommended_schedule": fallback_schedule,
            "motivation_message": "Sistem geçici olarak çevrimdışı olsa da, senin durmana gerek yok!",
            "energy_level": request.energy_level,
            "generated_at": datetime.now().isoformat()
        }


@router.post("/bulk-create", response_model=BulkCreateResponse, status_code=status.HTTP_201_CREATED)
def bulk_create_tasks(
    request: BulkCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Birden fazla gorevi tek istekte olusturur.

    Kullanim: AI gorev parcalama sonrasi kullanici
    "Listeme Ekle" butonuna basinca bu endpoint cagirilir.
    parent_task_id ile ana goreve baglanabilir.
    """
    # Eger parent_task_id verildiyse, ana gorevin bu kullaniciya ait oldugunu dogrula
    if request.parent_task_id:
        parent = (
            db.query(Task)
            .filter(Task.id == request.parent_task_id, Task.user_id == current_user.id)
            .first()
        )
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ana gorev bulunamadi veya size ait degil",
            )

    created_ids = []
    for item in request.tasks:
        new_task = Task(
            user_id=current_user.id,
            title=item.title,
            description=item.description,
            estimated_minutes=item.estimated_minutes,
            priority=item.priority or TaskPriority.LOW,
            parent_task_id=request.parent_task_id,
            tags=[],
        )
        db.add(new_task)
        db.flush()  # ID'yi almak icin flush
        created_ids.append(str(new_task.id))

    db.commit()

    return BulkCreateResponse(
        created_count=len(created_ids),
        task_ids=created_ids,
        message=f"{len(created_ids)} gorev basariyla olusturuldu",
    )
