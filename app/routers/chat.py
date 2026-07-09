"""
AI Sohbet (Chat) API endpoint'i.

Sprint 1: Basit chatbot (Tamamlandı)
Sprint 2: LangChain multi-agent orkestrasyon ve Hafıza Yönetimi (Director Agent Entegrasyonu)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.auth import get_current_user
from app.schemas.chat import ChatMessage, ChatResponse
from app.config import get_settings

# YENİ EKLENEN: Director prompt motorumuzu içe aktarıyoruz
from app.agents.director import build_director_system_prompt

# LangChain Kütüphaneleri
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory

router = APIRouter(prefix="/api/chat", tags=["AI Sohbet"])
settings = get_settings()

# Eski sabit "FORGE" promptunu tamamen kaldırdık. Sistem artık dinamik çalışıyor.

# Bellek yönetimi için in-memory sözlük (Kullanıcı başına ayrı hafıza tutar)
user_histories: dict[str, InMemoryChatMessageHistory] = {}


def get_session_history(session_id: str) -> InMemoryChatMessageHistory:
    """Kullanıcının sohbet geçmişini getirir veya yeni hafıza oluşturur."""
    if session_id not in user_histories:
        user_histories[session_id] = InMemoryChatMessageHistory()
    return user_histories[session_id]


@router.post("/", response_model=ChatResponse)
async def chat_with_ai(
    message: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    AI Director ile LangChain altyapısı üzerinden sohbet et.
    Sorumluluk skoru ve cold start verileriyle dinamik prompt beslemesi yapar.
    """

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API anahtarı ayarlanmamış. .env dosyasını kontrol edin.",
        )

    try:
        # 1. LangChain LLM Tanımlaması (Gemini 2.5 Flash kullanıyoruz)
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=settings.gemini_api_key,
            temperature=0.7 # Yaratıcılık ve netlik dengesi
        )

        # 2. DİNAMİK BEYNİ ÇAĞIR (Cold Start & Tone Adaptation)
        # Mevcut kullanıcıyı parametre olarak verip o anki duruma ve skora özel promptu üretiyoruz
        full_system_prompt = build_director_system_prompt(current_user)

        # 3. Prompt Şablonunu Hazırla
        prompt = ChatPromptTemplate.from_messages([
            ("system", full_system_prompt),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ])

        chain = prompt | llm
        chain_with_history = RunnableWithMessageHistory(
            chain,
            get_session_history,
            input_messages_key="input",
            history_messages_key="history",
        )

        # 4. Modeli Tetikle
        ai_message = chain_with_history.invoke(
            {"input": message.message},
            config={"configurable": {"session_id": str(current_user.id)}},
        )
        response_text = ai_message.content

        # Ajan adını ve geri dönüş objesini güncelledik
        return ChatResponse(
            response=response_text,
            agent_name="Director",
            suggestions=[],
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LangChain yanıt üretemedi: {str(e)}",
        )