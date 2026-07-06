"""
AI Planner Agent - Backend Integration Rehberi
YZTA-70 & YZTA-71 için Furkan & Mete'nin endpoint'lerine nasıl eklenecek?

Bu dosya örnek olarak, routers'da kullanılacak kodun yapısını gösterir.
Asıl implementasyon routers/tasks.py ve routers/chat.py dosyalarına yapılacak.
"""

# ============================================================================
# ÖRNEK 1: Görev Önceliklendirme Endpoint'i (FastAPI Route)
# ============================================================================
# Şu kodu routers/tasks.py dosyasına ekleyebilirsiniz:

"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.services import prioritize_tasks, PrioritizedTasksOutput
from app.database import get_db
from app.models.task import Task

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("/prioritize", response_model=PrioritizedTasksOutput)
async def prioritize_user_tasks(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)  # Auth dependency
):
    '''
    Kullanıcının tüm aktif görevlerini AI ile önceliklendirin.
    YZTA-70 İmplementasyonu
    '''
    
    # Veritabanından kullanıcının görevlerini al
    tasks = await db.execute(
        select(Task).where(Task.user_id == current_user.id)
    )
    user_tasks = tasks.scalars().all()
    
    if not user_tasks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Önceliklendirilebilecek görev bulunamadı."
        )
    
    # Task'leri dict formatına çevir (AI servisinin istediği format)
    tasks_for_ai = [
        {
            "title": task.title,
            "description": task.description or "Açıklama yok",
            "deadline": task.due_date.isoformat() if task.due_date else "Belirlenmemiş",
            "estimated_duration": task.estimated_duration or 30
        }
        for task in user_tasks
    ]
    
    # AI Servisi'ni çağır (async!)
    try:
        prioritized_output = await prioritize_tasks(
            tasks=tasks_for_ai,
            user_context="Öğleden sonra daha verimli çalışıyor."
        )
        
        # Veritabanında task'lerin ai_priority_score'larını güncelle
        for prioritized_task in prioritized_output.tasks:
            matching_task = next(
                (t for t in user_tasks if t.title == prioritized_task.task_name),
                None
            )
            if matching_task:
                matching_task.ai_priority_score = prioritized_task.priority_score
                matching_task.priority = prioritized_task.eisenhower_category
        
        await db.commit()
        
        return prioritized_output
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI servisi yapılandırma hatası: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Görev önceliklendirme hatası: {str(e)}"
        )
"""


# ============================================================================
# ÖRNEK 2: Görev Parçalama Endpoint'i (FastAPI Route)
# ============================================================================
# Şu kodu routers/tasks.py dosyasına ekleyebilirsiniz:

"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.services import break_down_task, SubTasksOutput
from app.database import get_db

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class BreakDownRequest(BaseModel):
    task_name: str
    task_description: Optional[str] = None
    estimated_time: Optional[int] = None


@router.post("/break-down", response_model=SubTasksOutput)
async def break_down_user_task(
    request: BreakDownRequest,
    current_user = Depends(get_current_user)  # Auth dependency
):
    '''
    Kompleks bir görevi alt görevlere bölün.
    YZTA-71 İmplementasyonu
    '''
    
    try:
        subtasks_output = await break_down_task(
            task_name=request.task_name,
            task_description=request.task_description,
            estimated_time=request.estimated_time
        )
        
        # İsteğe bağlı: Alt görevleri veritabanında kaydet
        # for subtask in subtasks_output.subtasks:
        #     new_subtask = Task(
        #         user_id=current_user.id,
        #         title=subtask.name,
        #         description=subtask.description,
        #         estimated_duration=subtask.estimated_time_minutes
        #     )
        #     db.add(new_subtask)
        # await db.commit()
        
        return subtasks_output
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI servisi yapılandırma hatası: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Görev parçalama hatası: {str(e)}"
        )
"""


# ============================================================================
# ÖRNEK 3: Kombinasyon - Günlük AI Önerileri (FastAPI Route)
# ============================================================================
# Şu kodu routers/chat.py veya yeni bir routers/ai.py dosyasına ekleyebilirsiniz:

"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services import get_ai_recommendations
from app.models.task import Task
from app.database import get_db

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/daily-recommendations")
async def get_daily_ai_plan(
    energy_level: str = "medium",  # Query param: low, medium, high
    available_hours: int = 8,  # Query param
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)  # Auth dependency
):
    '''
    Kullanıcının bugünün enerjisine ve zamanına göre günlük plan önerileri.
    YZTA-70 & YZTA-71 kombinasyonu
    '''
    
    # Kullanıcının görevlerini al
    result = await db.execute(
        select(Task).where(Task.user_id == current_user.id)
    )
    user_tasks = result.scalars().all()
    
    if not user_tasks:
        return {
            "message": "Henüz görev eklenmemiş. Lütfen görev ekleyerek başlayın.",
            "recommended_schedule": []
        }
    
    # Task'leri dict formatına çevir
    tasks_for_ai = [
        {
            "title": task.title,
            "description": task.description or "Açıklama yok",
            "deadline": task.due_date.isoformat() if task.due_date else "Belirlenmemiş",
            "estimated_duration": task.estimated_duration or 30
        }
        for task in user_tasks
    ]
    
    try:
        recommendations = await get_ai_recommendations(
            user_tasks=tasks_for_ai,
            user_energy_level=energy_level,
            available_time_minutes=available_hours * 60
        )
        
        return recommendations
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI önerileri oluşturma hatası: {str(e)}"
        )
"""


# ============================================================================
# KÖŞEli NOKTALARI & HATALI AYRILMASI
# ============================================================================

"""
FURKAN & METE İÇİN ÖNEMLİ HATIRLATMALAR:

1. ✅ Environment Variables:
   - .env dosyasına GEMINI_API_KEY=sk-xxxxx ekle
   - Settings() sınıfı bunu otomatik okuyacak

2. ✅ Database Integration:
   - Task modelinde ai_priority_score alanı zaten var (Task.py'de)
   - priority field'ını Eisenhower kategorileriyle güncelle

3. ✅ Error Handling:
   - API key eksik ise → ValueError
   - Network timeout ise → Try-except bloklarında handle et
   - LLM yanıtı geçersiz JSON ise → OutputParserException (ai_planner_agent.py'de handle ediliyor)

4. ✅ Async/Await:
   - ai_planner_agent.py'deki tüm fonksiyonlar ASYNC
   - FastAPI route'larda "async def" kullanmalısın
   - await prioritize_tasks(...) ile çağır

5. ✅ Rate Limiting (Opsiyonel):
   - Google Gemini API'nin rate limit'i var
   - Çok fazla request'ten kaçın
   - Redis cache ekleyebilirsin (redis_url zaten config.py'de var)

6. ✅ Logging:
   - ai_planner_agent.py LoggerDebug logs'ları kontrol et
   - Sorun olursa logger.error(...) hatalarını kontrol et

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DOĞUKAN'ın İmplementasyonu ✅:
✓ Pydantic modelleri ve validation
✓ LangChain prompt templates
✓ Google Gemini API integration (async)
✓ Output parsing + fallback mekanizması
✓ Error handling ve logging
✓ Modüler, reusable, async-first tasarım

FURKAN & METE'nin İşleri:
□ API endpoint'leri oluşturmak (routers/)
□ Database integration
□ Authentication/Authorization
□ Testing ve API documentation
"""
