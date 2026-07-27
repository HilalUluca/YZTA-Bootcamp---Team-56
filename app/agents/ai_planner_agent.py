"""

gemini api key 112 ve 117 satırları ile birlikte .env dosyasında ayarlanmalıdır.!!!!!!!

AI Planner Agent - LangChain tabanlı görev yönetimi ve optimizasyon servisi.
Görev önceliklendirme ve parçalamayı yapay zeka ile gerçekleştirir.

YZTA-70: Yapay zekayla görev önceliklendirme
YZTA-71: Büyük görevleri alt görevlere bölme
YZTA-93: 'Bugünün planı' prompt optimizasyonu (enerji bazlı sıralama, mola önerileri, motivasyon mesajı)
"""

import json
import logging
import random
from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, Field
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.exceptions import OutputParserException

from app.config import Settings

logger = logging.getLogger(__name__)


def _extract_text(response) -> str:
    """
    LLM yanıtından düz metni çıkarır.

    Bazı Gemini modelleri content'i düz string yerine blok listesi
    ([{"type": "text", "text": ...}]) olarak döndürür. Bu durumda sadece
    metni birleştirir, "extras" (base64 thought-signature vb.) alanlarını
    yok sayar; aksi halde parser.parse() liste alıp patlar.
    """
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                parts.append(block.get("text", ""))
        return "".join(parts)
    return str(content)


# ============================================================================
# PYDANTIC MODELLER
# ============================================================================

class PrioritizedTask(BaseModel):
    """Önceliklendirilmiş görev modeli."""
    
    task_name: str = Field(
        ..., 
        description="Görevin adı"
    )
    priority_score: int = Field(
        ..., 
        description="Öncelik skoru (1-5 arası, 5 en yüksek)",
        ge=1,
        le=5
    )
    ai_reasoning: str = Field(
        ...,
        description="Yapay zekanın bu önceliği neden verdiğinin açıklaması"
    )
    eisenhower_category: str = Field(
        ...,
        description="Eisenhower matrisi kategorisi: urgent_important, important, urgent, low"
    )


class PrioritizedTasksOutput(BaseModel):
    """Önceliklendirme çıktı modeli."""
    
    tasks: List[PrioritizedTask] = Field(
        ...,
        description="Önceliklendirilen görevler listesi"
    )
    summary: str = Field(
        ...,
        description="Genel özet ve öneriler"
    )


class SubTask(BaseModel):
    """Alt görev modeli."""
    
    name: str = Field(
        ...,
        description="Alt görevin adı"
    )
    estimated_time_minutes: int = Field(
        ...,
        description="Tahmini tamamlanma süresi (dakika)",
        ge=1
    )
    description: Optional[str] = Field(
        None,
        description="Alt görevin kısa açıklaması"
    )


class SubTasksOutput(BaseModel):
    """Görev parçalama çıktı modeli."""
    
    main_task: str = Field(
        ...,
        description="Ana görevin adı"
    )
    subtasks: List[SubTask] = Field(
        ...,
        description="Ana görevin bölündüğü alt görevler"
    )
    total_estimated_time: int = Field(
        ...,
        description="Toplam tahmini tamamlanma süresi (dakika)"
    )
    approach_explanation: str = Field(
        ...,
        description="Görevin neden bu şekilde bölündüğünün açıklaması"
    )


# ============================================================================
# LangChain SETUP & PARSER'LAR
# ============================================================================

def _get_llm():
    """Google Gemini LLM'i lazım olduğu yerden oluştur."""
    settings = Settings()
    
    if not settings.gemini_api_key:
        raise ValueError(
            "GEMINI_API_KEY çevre değişkeni ayarlanmamış. "
            ".env dosyasında GEMINI_API_KEY'i belirleyin."
        )
    
    return ChatGoogleGenerativeAI(
        model="gemini-flash-latest",
        google_api_key=settings.gemini_api_key,
        temperature=0.7,
        convert_system_message_to_human=True
    )


def _parse_json_with_fallback(
    text: str,
    model_class: type,
    field_name: str = None
) -> dict:
    """
    JSON parse fallback mekanizması.
    
    Eğer output parser JSON'u parse edemezse, manuel olarak 
    text'ten JSON bloğunu çıkarıp parse etmeyi dener.
    """
    try:
        # İlk olarak direkt JSON parse etmeyi dene
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning(f"Direkt JSON parse başarısız, fallback kullanılıyor.")
        
        # Text'ten JSON bloğunu çıkar (```json ... ``` formatında olabilir)
        if "```json" in text:
            json_str = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            json_str = text.split("```")[1].split("```")[0].strip()
        else:
            # Son çare: { ile başlıyor ve } ile biten kısmı bul
            start_idx = text.find("{")
            end_idx = text.rfind("}") + 1
            if start_idx != -1 and end_idx > start_idx:
                json_str = text[start_idx:end_idx]
            else:
                raise OutputParserException(
                    f"JSON bloğu bulunamadı. LLM çıktısı: {text[:200]}..."
                )
        
        return json.loads(json_str)


# ============================================================================
# GÖREV ÖNCELİKLENDİRME (YZTA-70)
# ============================================================================

async def prioritize_tasks(
    tasks: List[dict],
    user_context: Optional[str] = None
) -> PrioritizedTasksOutput:
    """
    Kullanıcının görevlerini Eisenhower matrisine göre analiz ederek 
    önceliklendirmek. YZTA-70: Yapay zekayla görev önceliklendirme.
    
    Args:
        tasks: Görev listesi. Her görev dict şu alanları içermeli:
            - title: str (görev adı)
            - description: Optional[str] (görev açıklaması)
            - deadline: Optional[str] (deadline tarihi, ISO format)
            - estimated_duration: Optional[int] (dakika cinsinden)
            - user_goals: Optional[str] (kullanıcının günlük hedefleri)
        
        user_context: Opsiyonel - Kullanıcı duygu durumu veya ek context
    
    Returns:
        PrioritizedTasksOutput: Önceliklendirilen görevler ve özet
    
    Raises:
        ValueError: API key veya diğer konfigürasyon hataları
        OutputParserException: JSON parse hatası
    """
    
    llm = _get_llm()
    
    # Task'leri string formatına çevir
    tasks_str = "\n".join(
        [f"{i+1}. {t.get('title', 'Başlıksız')} (Açıklama: {t.get('description', 'Yok')}, Deadline: {t.get('deadline', 'Yok')})"
         for i, t in enumerate(tasks)]
    )
    
    # Prompt Template
    prompt_template = PromptTemplate.from_template(
        """Sen bir kişisel verimlilik danışmanısın. Kullanıcının görevlerini 
Eisenhower Matrisi (Acil & Önemli, Önemli, Acil, Düşük) kategorilerine 
göre sınıflandırıp önceliklendirmen gerekiyor.

GÖREVLER:
{tasks_text}

{context_note}

Lütfen her görev için şu JSON formatında analiz yap:
{format_instructions}

Çıktı kesinlikle geçerli JSON olmalı."""
    )
    
    parser = PydanticOutputParser(pydantic_object=PrioritizedTasksOutput)
    
    context_note = ""
    if user_context:
        context_note = f"\nKULLANICI CONTEXT: {user_context}"
    
    prompt = prompt_template.format(
        tasks_text=tasks_str,
        context_note=context_note,
        format_instructions=parser.get_format_instructions()
    )
    
    try:
        logger.info("LLM'e görev önceliklendirme isteği gönderiliyor...")
        
        # LangChain chain - async
        response = await llm.ainvoke(prompt)
        response_text = _extract_text(response)

        logger.debug(f"LLM yanıtı: {response_text[:300]}...")

        # JSON parse ve Pydantic model validation
        try:
            output = parser.parse(response_text)
        except OutputParserException:
            logger.warning("Parser başarısız, fallback JSON parsing kullanılıyor...")
            json_data = _parse_json_with_fallback(
                response_text,
                PrioritizedTasksOutput
            )
            output = PrioritizedTasksOutput(**json_data)
        
        logger.info(f"✅ {len(output.tasks)} görev başarıyla önceliklendirdi.")
        return output
    
    except Exception as e:
        logger.error(f"Görev önceliklendirme hatası: {str(e)}")
        raise


# ============================================================================
# GÖREV PARÇALAMA (YZTA-71)
# ============================================================================

async def break_down_task(
    task_name: str,
    task_description: Optional[str] = None,
    estimated_time: Optional[int] = None
) -> SubTasksOutput:
    """
    Büyük ve karmaşık görevleri mantıksal alt adımlara bölmek. 
    YZTA-71: Büyük görevleri alt görevlere bölme.
    
    Args:
        task_name: Ana görevin adı
        task_description: Görevin detaylı açıklaması
        estimated_time: Tahmini toplam süre (dakika)
    
    Returns:
        SubTasksOutput: Alt görevlere bölünen görev
    
    Raises:
        ValueError: API key veya diğer konfigürasyon hataları
        OutputParserException: JSON parse hatası
    """
    
    llm = _get_llm()
    
    # Görev metin hazırlığı
    task_text = f"Ana Görev: {task_name}"
    if task_description:
        task_text += f"\nAçıklama: {task_description}"
    if estimated_time:
        task_text += f"\nTahmini Toplam Süre: {estimated_time} dakika"
    
    # Prompt Template
    prompt_template = PromptTemplate.from_template(
        """Sen bir proje yönetimi uzmanısın. Verilen büyük ve karmaşık görevi 
praktik, uygulanabilir alt görevlere böl. Her alt görev:
- İlişkili (bağlıdır)
- Ölçülebilir (sonucu test edilebilir)
- Tamamlanabilir (bir kişi tarafından yapılabilir)
- Zaman tahmini içerir

GÖREV:
{task_text}

Lütfen şu JSON formatında cevap ver:
{format_instructions}

Çıktı kesinlikle geçerli JSON olmalı."""
    )
    
    parser = PydanticOutputParser(pydantic_object=SubTasksOutput)
    
    prompt = prompt_template.format(
        task_text=task_text,
        format_instructions=parser.get_format_instructions()
    )
    
    try:
        logger.info(f"LLM'e görev parçalama isteği gönderiliyor: {task_name}")
        
        # LangChain chain - async
        response = await llm.ainvoke(prompt)
        response_text = _extract_text(response)

        logger.debug(f"LLM yanıtı: {response_text[:300]}...")

        # JSON parse ve Pydantic model validation
        try:
            output = parser.parse(response_text)
        except OutputParserException:
            logger.warning("Parser başarısız, fallback JSON parsing kullanılıyor...")
            json_data = _parse_json_with_fallback(
                response_text,
                SubTasksOutput
            )
            output = SubTasksOutput(**json_data)
        
        logger.info(f"✅ '{task_name}' başarıyla {len(output.subtasks)} alt görev'e bölündü.")
        return output
    
    except Exception as e:
        logger.error(f"Görev parçalama hatası: {str(e)}")
        raise


# ============================================================================
# YARDIMCI FONKSİYONLAR (YZTA-93: enerji bazlı zenginleştirme)
# ============================================================================

# Enerji seviyesine göre çalışma/mola blok konfigürasyonu.
# work_minutes: bir odak bloğunun süresi, break_minutes: sonrasındaki mola,
# max_tasks: bu enerji seviyesinde önerilecek maksimum görev sayısı (bilişsel yük kontrolü).
_ENERGY_CONFIG = {
    "low": {"work_minutes": 20, "break_minutes": 10, "max_tasks": 1},
    "medium": {"work_minutes": 35, "break_minutes": 7, "max_tasks": 3},
    "high": {"work_minutes": 55, "break_minutes": 10, "max_tasks": 6},
}

_BREAK_SUGGESTIONS = {
    "low": ["Kısa bir yürüyüş yap", "Su iç ve pencereden dışarı bak", "Gözlerini dinlendir"],
    "medium": ["5 dakika esneme hareketleri yap", "Bir bardak su iç", "Derin nefes egzersizi yap"],
    "high": ["Kısa bir mola ver ama momentumu kaybetme", "Ayağa kalk, gerinme yap", "Su iç"],
}

_MOTIVATION_MESSAGES = {
    "low": [
        "Bugün tüm listeyi unut. Tek bir göreve odaklan, gerisi beklesin.",
        "Enerjin düşük, bu bir duraklama değil bir darboğaz. Sadece bir adım at.",
        "Küçük bir başlangıç bile bugün için yeterli. Tek göreve odaklan.",
    ],
    "medium": [
        "Dengeli bir tempo tutturabilirsin. Öncelikli görevlerden başla.",
        "Bugün istikrarlı ilerleyebileceğin bir gün. Listeyi sırayla işle.",
        "Ne çok yavaş ne çok hızlı; sağlam adımlarla ilerle.",
    ],
    "high": [
        "Enerjin yüksek, bugün zor görevi ilk sıraya al ve bitir.",
        "Bu momentumu en kritik göreve yönlendir, gerisi kolaylaşır.",
        "Bugün ağır işi kaldırabilirsin. En zorlu görevle başla.",
    ],
}


def _normalize_energy_level(energy_level: str) -> str:
    """Beklenmeyen bir değer gelirse 'medium'a düşer, böylece sistem hata vermez."""
    normalized = (energy_level or "medium").strip().lower()
    return normalized if normalized in _ENERGY_CONFIG else "medium"


def _generate_motivation_message(energy_level: str, task_count: int) -> str:
    """Enerji seviyesine göre rotasyonlu, tekrarsız kısa motivasyon mesajı üretir."""
    pool = _MOTIVATION_MESSAGES[energy_level]
    message = random.choice(pool)
    if task_count == 0:
        return "Listende açık görev yok. Yeni bir hedef belirlemek ister misin?"
    return message


def _create_schedule(
    tasks: List[PrioritizedTask],
    available_time: int,
    energy_level: str
) -> List[dict]:
    """
    Prioritized task'lerden enerji seviyesine duyarlı bir günlük çizelge oluşturur.
    Görev bloklarının arasına, enerjiye göre ayarlanmış mola blokları eklenir.

    YZTA-93: Artık energy_level parametresi gerçekten kullanılıyor:
    - Düşük enerji: tek (veya az sayıda) görev + sık/kısa molalar (bilişsel yük azaltma)
    - Orta enerji: dengeli sayıda görev + orta molalar
    - Yüksek enerji: daha fazla görev + uzun odak blokları
    """
    energy_level = _normalize_energy_level(energy_level)
    config = _ENERGY_CONFIG[energy_level]

    schedule: List[dict] = []
    assigned_time = 0

    # Sırala: Urgent & Important, Important, Urgent, Low (mevcut mantık korunuyor)
    category_order = {
        "urgent_important": 0,
        "important": 1,
        "urgent": 2,
        "low": 3
    }

    sorted_tasks = sorted(
        tasks,
        key=lambda t: (category_order.get(t.eisenhower_category, 4), -t.priority_score)
    )

    # Enerji seviyesine göre görev sayısını sınırla (bilişsel yük kontrolü)
    sorted_tasks = sorted_tasks[: config["max_tasks"]]

    for i, task in enumerate(sorted_tasks):
        if assigned_time >= available_time:
            break

        block_duration = min(config["work_minutes"], available_time - assigned_time)

        schedule.append({
            "block_type": "task",
            "task_name": task.task_name,
            "priority_score": task.priority_score,
            "category": task.eisenhower_category,
            "suggested_duration_minutes": block_duration,
        })
        assigned_time += block_duration

        # Son görevden sonra mola eklemeye gerek yok
        is_last_task = i == len(sorted_tasks) - 1
        if not is_last_task and assigned_time < available_time:
            break_duration = min(config["break_minutes"], available_time - assigned_time)
            if break_duration <= 0:
                continue
            schedule.append({
                "block_type": "break",
                "suggestion": random.choice(_BREAK_SUGGESTIONS[energy_level]),
                "duration_minutes": break_duration,
            })
            assigned_time += break_duration

    return schedule


async def get_ai_recommendations(
    user_tasks: List[dict],
    user_energy_level: str = "medium",  # low, medium, high
    available_time_minutes: int = 480  # Varsayılan: 8 saat
) -> dict:
    """
    Kullanıcının günlük enerjisine ve kullanılabilir süresine göre 
    yapay zeka önerileri sun.

    YZTA-93: Çıktı zenginleştirildi:
    - recommended_schedule artık enerji seviyesine göre görev sayısı/blok
      uzunluğu ayarlıyor ve mola bloklarını da içeriyor.
    - motivation_message: enerji seviyesine göre kısa, rotasyonlu bir mesaj.
    
    Args:
        user_tasks: Görev listesi
        user_energy_level: Kullanıcının günlük enerjisi
        available_time_minutes: Bugün kullanılabilir zaman (dakika)
    
    Returns:
        dict: Günlük plan, mola önerileri ve motivasyon mesajı içeren öneri paketi
    """
    
    try:
        energy_level = _normalize_energy_level(user_energy_level)
        context = f"Kullanıcı enerjisi: {energy_level}. Bugün {available_time_minutes} dakika boş zamanı var."
        
        prioritized = await prioritize_tasks(
            user_tasks,
            user_context=context
        )
        
        schedule = _create_schedule(
            prioritized.tasks,
            available_time_minutes,
            energy_level
        )

        recommendation = {
            "prioritized_tasks": [t.model_dump() for t in prioritized.tasks],
            "summary": prioritized.summary,
            "recommended_schedule": schedule,
            "motivation_message": _generate_motivation_message(energy_level, len(prioritized.tasks)),
            "energy_level": energy_level,
            "generated_at": datetime.now().isoformat()
        }
        
        return recommendation
    
    except Exception as e:
        logger.error(f"AI önerilendirme hatası: {str(e)}")
        raise