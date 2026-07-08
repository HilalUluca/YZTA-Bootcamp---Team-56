# AI Planner Agent - Backend Integration Rehberi

**YZTA-70 & YZTA-71** için Furkan & Mete'nin endpoint'lerine nasıl eklenecek?

> Bu dosya örnek olarak, routers'da kullanılacak kodun yapısını gösterir.
> Asıl implementasyon `routers/tasks.py` ve `routers/chat.py` dosyalarına yapılacak.

---

## 📋 İçindekiler
1. [Görev Önceliklendirme Endpoint'i (YZTA-70)](#örnek-1-görev-önceliklendirme-endpoints)
2. [Görev Parçalama Endpoint'i (YZTA-71)](#örnek-2-görev-parçalama-endpoints)
3. [Kombinasyon - Günlük AI Önerileri](#örnek-3-kombinasyon--günlük-ai-önerileri)
4. [Önemli Hatırlatmalar](#önemli-hatırlatmalar)

---

## ÖRNEK 1: Görev Önceliklendirme Endpoint'i (YZTA-70)

Şu kodu **`routers/tasks.py`** dosyasına ekleyebilirsiniz:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services import prioritize_tasks, PrioritizedTasksOutput
from app.database import get_db
from app.models.task import Task
from app.routers.auth import get_current_user  # Auth dependency

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("/prioritize", response_model=PrioritizedTasksOutput)
async def prioritize_user_tasks(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Kullanıcının tüm aktif görevlerini AI ile önceliklendirin.
    YZTA-70 İmplementasyonu
    
    Returns:
        PrioritizedTasksOutput: Önceliklendirilen görevler ve özet
    """
    
    # Veritabanından kullanıcının görevlerini al
    result = await db.execute(
        select(Task).where(Task.user_id == current_user.id)
    )
    user_tasks = result.scalars().all()
    
    if not user_tasks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Önceliklendirilebilecek görev bulunamadı."
        )
    
    # Task'leri dict formatına çevir (AI servisinin beklediği format)
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
            user_context=f"Kullanıcı: {current_user.name}, Saat: {datetime.now().hour}"
        )
        
        # ✅ Veritabanında task'lerin skorlarını güncelle (isteğe bağlı)
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
```

### 📝 Endpoint Kullanım Örneği

```bash
POST /api/tasks/prioritize

Response (200):
{
  "tasks": [
    {
      "task_name": "Proje raporu yazma",
      "priority_score": 5,
      "ai_reasoning": "Yarın deadline var ve proje başarısı bu rapora bağlı",
      "eisenhower_category": "urgent_important"
    },
    ...
  ],
  "summary": "3 acil görev bulunmaktadır. Bugünün ilk saatlerini raporun tamamlanmasına ayırmanız önerilir."
}
```

---

## ÖRNEK 2: Görev Parçalama Endpoint'i (YZTA-71)

Şu kodu **`routers/tasks.py`** dosyasına ekleyebilirsiniz:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.services import break_down_task, SubTasksOutput
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class BreakDownRequest(BaseModel):
    """Görev parçalama isteği modeli"""
    task_name: str
    task_description: Optional[str] = None
    estimated_time: Optional[int] = None  # Dakika cinsinden


@router.post("/break-down", response_model=SubTasksOutput)
async def break_down_user_task(
    request: BreakDownRequest,
    current_user = Depends(get_current_user)
):
    """
    Kompleks bir görevi mantıksal alt görevlere bölün.
    YZTA-71 İmplementasyonu
    
    Args:
        request.task_name: Ana görevin adı
        request.task_description: Görevin detaylı açıklaması
        request.estimated_time: Tahmini toplam süre (dakika)
    
    Returns:
        SubTasksOutput: Alt görevlere ayrılmış görev
    """
    
    try:
        subtasks_output = await break_down_task(
            task_name=request.task_name,
            task_description=request.task_description,
            estimated_time=request.estimated_time
        )
        
        # ✅ İsteğe bağlı: Alt görevleri veritabanında kaydet
        # for subtask in subtasks_output.subtasks:
        #     new_subtask = Task(
        #         user_id=current_user.id,
        #         parent_task_id=parent_task_id,  # İlişki kurmak için
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
```

### 📝 Endpoint Kullanım Örneği

```bash
POST /api/tasks/break-down

Request:
{
  "task_name": "Web sitesi tasarı ve geliştir",
  "task_description": "React + FastAPI ile e-commerce sitesi",
  "estimated_time": 480
}

Response (200):
{
  "main_task": "Web sitesi tasarı ve geliştir",
  "subtasks": [
    {
      "name": "Database şemasını tasarla",
      "estimated_time_minutes": 120,
      "description": "PostgreSQL schema ve relationships"
    },
    {
      "name": "FastAPI backend kurulumu",
      "estimated_time_minutes": 90,
      "description": "User model, auth, basic routes"
    },
    ...
  ],
  "total_estimated_time": 480,
  "approach_explanation": "Görev backend altyapısıyla başlayıp frontend'e geçecek şekilde bölündü."
}
```

---

## ÖRNEK 3: Kombinasyon - Günlük AI Önerileri

Şu kodu **`routers/ai.py`** (yeni dosya) veya **`routers/chat.py`** dosyasına ekleyebilirsiniz:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services import get_ai_recommendations
from app.models.task import Task
from app.database import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/daily-recommendations")
async def get_daily_ai_plan(
    energy_level: str = "medium",  # Query param: low, medium, high
    available_hours: int = 8,      # Query param: Bugünün boş saati
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Kullanıcının bugünün enerjisine ve zamanına göre günlük plan önerileri.
    YZTA-70 & YZTA-71 kombinasyonu
    
    Query Params:
        energy_level: low, medium, high
        available_hours: Bugün kullanılabilir saat (int)
    
    Returns:
        dict: Önceliklendirilen görevler + çizelge
    """
    
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
```

### 📝 Endpoint Kullanım Örneği

```bash
GET /api/ai/daily-recommendations?energy_level=high&available_hours=8

Response (200):
{
  "prioritized_tasks": [...],
  "summary": "Bugün 8 saatiniz var ve enerjiniz yüksek...",
  "recommended_schedule": [
    {
      "task_name": "Proje raporu yazma",
      "priority_score": 5,
      "category": "urgent_important",
      "suggested_duration_minutes": 120
    },
    ...
  ],
  "generated_at": "2026-07-06T14:30:00"
}
```

---

## ⚠️ Önemli Hatırlatmalar

### 1️⃣ Environment Variables
```bash
# .env dosyasına MUTLAKA ekle:
GEMINI_API_KEY=sk-xxxxx

# Settings() sınıfı bunu otomatik okuyacak (config.py'de tanımlı)
```

### 2️⃣ Database Integration
- `Task` modelinde `ai_priority_score` alanı **zaten var** ✅ (models/task.py)
- `priority` field'ını `Enum(TaskPriority)`'ye güncelle
- Eisenhower kategorileri: `urgent_important`, `important`, `urgent`, `low`

### 3️⃣ Error Handling
| Hata | Kaynak | Çözüm |
|------|--------|--------|
| `ValueError` | GEMINI_API_KEY eksik | `.env` dosyasını kontrol et |
| `OutputParserException` | Geçersiz JSON yanıt | Fallback parser'ı handle ediyor (ai_planner_agent.py'de) |
| Network timeout | API sunucusu ulaşılamıyor | Retry logic ekle (opsiyonel) |

### 4️⃣ Async/Await Pattern
```python
# ❌ YANLIŞ:
prioritized = prioritize_tasks(tasks)

# ✅ DOĞRU:
prioritized = await prioritize_tasks(tasks)

# ai_planner_agent.py'deki tüm fonksiyonlar ASYNC'dir!
```

### 5️⃣ Rate Limiting (Opsiyonel)
- Google Gemini API'nin rate limit'i var
- Çok fazla request'ten kaçın
- Redis cache'leme ekleyebilirsin (redis_url zaten config.py'de var)

### 6️⃣ Logging
```python
# Logger output'ları kontrol et:
# DEBUG: LLM yanıtları
# INFO: Başarılı işlemler
# ERROR: Hata detayları
```

---

## 📊 Kontrol Listesi (Furkan & Mete)

- [ ] `.env` dosyasında `GEMINI_API_KEY` tanımlı
- [ ] `routers/tasks.py` veya `routers/ai.py` dosyaları güncellendi
- [ ] Endpoint'ler Swagger UI'de görünüyor (`http://localhost:8000/docs`)
- [ ] Database migration'ları çalıştırıldı (eğer gerekiyorsa)
- [ ] Unit test'ler yazıldı ve geçti
- [ ] Code review yapıldı

---

## 🎯 İşbölümü Özeti

### Doğukan (AI Developer) - ✅ TAMAMLANDI
- ✅ Pydantic modelleri ve validation
- ✅ LangChain prompt templates
- ✅ Google Gemini API integration (async)
- ✅ Output parsing + fallback mekanizması
- ✅ Error handling ve logging
- ✅ Modüler, reusable, async-first tasarım
- ✅ Entegrasyon rehberi (bu dosya)

### Furkan & Mete (Backend Developers) - TODO
- [ ] API endpoint'leri oluşturmak (routers/ dosyalarında)
- [ ] Database integration (Task model güncellemesi)
- [ ] Authentication/Authorization (get_current_user dependency)
- [ ] Testing (unit, integration, API tests)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] GEMINI_API_KEY .env'ye eklemek

---

**Son Güncelleme:** 6 Temmuz 2026  
**Sorumlular:** Doğukan Kaya (AI Developer), Furkan Türker & Mete Ülken (Backend)  
**Sprint:** Sprint 2 (YZTA-70, YZTA-71)
