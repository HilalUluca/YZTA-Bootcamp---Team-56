import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.user import User
from app.models.chat import ChatMessageDB
from app.models.focus_session import Reflection
from app.models.task import Task
from app.config import get_settings
from app.schemas.profile import UserProfileData

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

# Profilleme Promptu (Kullanıcı Niyeti + Profil Güvenliği)
PROFILER_SYSTEM_PROMPT = """
Sen usta bir Psikolog ve Verimlilik Uzmanısın. Kullanıcının son dönem davranışlarını (Sohbetleri, Görevleri, Günlük Yansımaları) analiz ederek "Uzun Süreli Yapay Zeka Profili" (Long-Term Memory Profile) oluşturuyorsun.

KURALLAR:
1. Sadece sana verilen "Sinyaller" (Signals) verisinden çıkarım yap.
2. Emin olmadığın veya veri yetersiz olan alanları "unknown" veya boş olarak işaretle (örneğin risk_signals için veri yoksa boş liste bırak).
3. Uydurma, hayali veya varsayımsal kişisel bilgi üretme.
4. "Kullanıcı çok tembel", "İşe yaramaz" gibi negatif ve yargılayıcı ifadeler KULLANMA; bunun yerine "Tükenmişlik riski taşıyor", "Erteleme eğilimi var" gibi profesyonel/analitik dil kullan.
5. Kullanıcı sana daha önce bir hedef söylemişse, ancak verilerde yeni hedefler varsa eski ile yeniyi harmanla veya güncelle.

Cevabın kesinlikle ve sadece senden istenen JSON (Pydantic şeması) yapısına tam olarak uymalıdır. Format dışına çıkma, markdown ekleme.
"""

profiler_prompt = ChatPromptTemplate.from_messages([
    ("system", PROFILER_SYSTEM_PROMPT),
    ("human", "Lütfen aşağıdaki sinyalleri analiz edip AI Profilini oluştur/güncelle.\n\nSİNYALLER:\n{signals}")
])

def gather_user_signals(db: Session, user_id: str, days: int = 14) -> str:
    """Belirli bir gün geriye giderek kullanıcı verilerini toplar ve metne çevirir."""
    target_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # 1. Chat History
    recent_chats = (
        db.query(ChatMessageDB)
        .filter(ChatMessageDB.user_id == user_id, ChatMessageDB.created_at >= target_date)
        .order_by(desc(ChatMessageDB.created_at))
        .limit(30) # Sadece en son 30 mesaja (maks) bakalım ki token çok şişmesin
        .all()
    )
    recent_chats.reverse()
    chat_text = "\n".join([f"{c.sender}: {c.message}" for c in recent_chats])
    if not chat_text:
        chat_text = "Son zamanlarda sohbet geçmişi yok."

    # 2. Reflections
    recent_reflections = (
        db.query(Reflection)
        .filter(Reflection.user_id == user_id, Reflection.date >= target_date)
        .order_by(desc(Reflection.date))
        .all()
    )
    reflection_text = ""
    for r in recent_reflections:
        reflection_text += f"- Tarih: {r.date.strftime('%Y-%m-%d')}, Mood: {r.mood}, Enerji: {r.energy_level}/10\n"
        if r.wins: reflection_text += f"  Wins: {r.wins}\n"
        if r.improvements: reflection_text += f"  Improvements: {r.improvements}\n"

    if not reflection_text:
        reflection_text = "Son zamanlarda günlük yansıma (reflection) yok."

    # 3. Tasks
    recent_tasks = (
        db.query(Task)
        .filter(Task.user_id == user_id, Task.created_at >= target_date)
        .order_by(desc(Task.created_at))
        .limit(20)
        .all()
    )
    task_text = ""
    for t in recent_tasks:
        task_text += f"- Görev: {t.title} | Durum: {t.status}\n"
        
    if not task_text:
        task_text = "Son zamanlarda eklenmiş görev yok."

    # Toparlanan Sinyal Metni
    signals = f"""
--- SOHBET GEÇMİŞİ (Son 30 mesaj) ---
{chat_text}

--- GÜNLÜK YANSIMALAR (Son {days} gün) ---
{reflection_text}

--- GÖREVLER (Son {days} gün) ---
{task_text}
"""
    return signals

def generate_ai_profile(db: Session, user: User) -> UserProfileData:
    """
    Sinyalleri toplar ve LLM'i çalıştırıp JSON/Pydantic modelinde profili üretir.
    Üretilen profili User nesnesindeki ai_profile sözlüğüne yazar.
    """
    settings = get_settings()
    days_to_look_back = 14 # Son 2 hafta sinyalleri (Compact v1)
    
    signals = gather_user_signals(db, user.id, days=days_to_look_back)
    
    # LLM Modeli (Structured Output destekleyen model kullanıyoruz - gemini-flash-latest v1 compact)
    # Token maliyeti ve hız (latency) trade-off'u için flash model ideal.
    llm = ChatGoogleGenerativeAI(
        model="gemini-flash-latest",
        google_api_key=settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "dummy"),
        temperature=0.1
    )
    
    # Pydantic yapılandırmasını modele bağla
    structured_llm = llm.with_structured_output(UserProfileData)
    chain = profiler_prompt | structured_llm
    
    try:
        # LLM'i tetikle
        result: UserProfileData = chain.invoke({"signals": signals})
        
        # Meta dataları elle tamamla
        now_str = datetime.now(timezone.utc).isoformat()
        start_date_str = (datetime.now(timezone.utc) - timedelta(days=days_to_look_back)).strftime('%Y-%m-%d')
        end_date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        result.generated_at = now_str
        result.last_updated_from_range = f"{start_date_str} to {end_date_str}"
        
        # Kullanıcının profilini güncelle
        profile = user.ai_profile or {}
        # Sadece "user_profile" alt field'ini güncelliyoruz ki diğer memory (conversation_summary) silinmesin.
        profile["user_profile"] = result.model_dump()
        
        user.ai_profile = dict(profile)
        db.commit()
        
        logger.info(f"AI Profil başarıyla güncellendi (User ID: {user.id})")
        return result
        
    except Exception as e:
        logger.error(f"AI Profil oluşturulamadı: {e}")
        db.rollback()
        raise e
