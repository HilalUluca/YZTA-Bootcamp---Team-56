import logging
import os
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.chat import ChatMessageDB
from app.models.user import User
from app.config import get_settings
from app.prompts.summary_prompt import summary_prompt_template

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage

logger = logging.getLogger(__name__)

def get_recent_messages(db: Session, user_id: str, limit: int) -> List[ChatMessageDB]:
    """Veritabanından kullanıcının en son N mesajını çeker (en eski -> en yeni sırasında)."""
    past_db_messages = (
        db.query(ChatMessageDB)
        .filter(ChatMessageDB.user_id == user_id)
        .order_by(desc(ChatMessageDB.created_at))
        .limit(limit)
        .all()
    )
    past_db_messages.reverse()
    return past_db_messages

def get_conversation_context(db: Session, user: User) -> tuple[str, List[BaseMessage]]:
    """
    Seçilen stratejiye (last_n veya summary_buffer) göre LLM'e verilecek 
    sistem özeti metnini (varsa) ve son mesajların listesini (LangChain objesi olarak) döner.
    """
    settings = get_settings()
    strategy = settings.memory_strategy
    
    # Her halükarda recent_window kadar mesaj çekeceğiz
    recent_limit = settings.recent_window_size if strategy == "summary_buffer" else 10
    recent_db_msgs = get_recent_messages(db, user.id, recent_limit)
    
    # LangChain message tipine çevir
    history_messages = []
    for msg in recent_db_msgs:
        if msg.sender == "human":
            history_messages.append(HumanMessage(content=msg.message))
        elif msg.sender == "ai":
            history_messages.append(AIMessage(content=msg.message))

    summary_text = ""
    if strategy == "summary_buffer":
        # Özeti User.ai_profile içinden alıyoruz
        profile = user.ai_profile or {}
        summary_text = profile.get("conversation_summary", "")

    return summary_text, history_messages

def update_summary_if_needed(db: Session, user_id: str):
    """
    Asenkron Background Task olarak çalışması için tasarlandı.
    Kullanıcının toplam mesaj sayısına bakar, eğer SUMMARY_UPDATE_INTERVAL
    kadar yeni mesaj (veya daha fazlası) geldiyse özeti günceller.
    """
    try:
        settings = get_settings()
        if settings.memory_strategy != "summary_buffer":
            return
            
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return
            
        profile = user.ai_profile or {}
        last_summarized_count = profile.get("last_summarized_msg_count", 0)
        
        total_msg_count = db.query(ChatMessageDB).filter(ChatMessageDB.user_id == user_id).count()
        
        # Eğer henüz update aralığına ulaşılmadıysa dön
        if total_msg_count - last_summarized_count < settings.summary_update_interval:
            return
            
        logger.info(f"Summary update triggered for user {user_id}. Messages to summarize: {total_msg_count - last_summarized_count}")
        
        # Sadece son özetlenen mesajdan sonraki mesajları alıp özetleyiciye vermeliyiz.
        # Veya basitçe son N mesajı (örneğin interval kadar) alabiliriz.
        messages_to_summarize = (
            db.query(ChatMessageDB)
            .filter(ChatMessageDB.user_id == user_id)
            .order_by(desc(ChatMessageDB.created_at))
            .limit(settings.summary_update_interval)
            .all()
        )
        messages_to_summarize.reverse()
        
        recent_text = ""
        for msg in messages_to_summarize:
            role = "Kullanıcı" if msg.sender == "human" else "AI"
            recent_text += f"{role}: {msg.message}\n"
            
        current_summary = profile.get("conversation_summary", "Henüz özet yok.")
        
        # LLM Çağrısı (Düşük Temperature - Deterministik)
        llm = ChatGoogleGenerativeAI(
            model="gemini-flash-latest",
            google_api_key=settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "dummy"),
            temperature=0.1
        )
        
        chain = summary_prompt_template | llm
        
        result = chain.invoke({
            "current_summary": current_summary,
            "recent_messages": recent_text
        })
        
        new_summary = result.content
        
        # User tablosunu güncelle
        profile["conversation_summary"] = new_summary
        profile["last_summarized_msg_count"] = total_msg_count
        
        # JSON'u tetiklemek için yeniden atama gerekebilir (SQLAlchemy JSON field update tracking)
        user.ai_profile = dict(profile)
        
        # Mevcut db session'u thread-safe değilse sorun çıkarabilir.
        # Ancak BackgroundTasks genellikle aynı session'u paylaştığı için commit ediyoruz.
        # Daha güvenli yol: Bu fonksiyon içinde yepyeni bir session üretmektir,
        # fakat proje mimarisinde manuel session generator yoksa parametre olan db'yi kullanacağız.
        db.commit()
        logger.info(f"Successfully updated conversation summary for user {user_id}.")
        
    except Exception as e:
        logger.error(f"Error updating summary for user {user_id}: {e}")
        db.rollback()
