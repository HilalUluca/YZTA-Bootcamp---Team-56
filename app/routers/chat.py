"""
AI Sohbet (Chat) API endpoint'i.

Sprint 1: Basit chatbot (Tamamlandı)
Sprint 2: LangChain multi-agent orkestrasyon ve Hafıza Yönetimi (Director Agent Entegrasyonu)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.chat import ChatMessageDB
from app.services.auth import get_current_user
from app.schemas.chat import ChatMessage, ChatResponse
from app.config import get_settings

# YENİ EKLENEN: Director prompt motorumuzu içe aktarıyoruz
from app.agents.director import build_director_system_prompt, classify_intent
from app.services import ai_planner_agent
from app.models.task import Task, TaskStatus

# LangChain Kütüphaneleri
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory

router = APIRouter(prefix="/api/chat", tags=["AI Sohbet"])
settings = get_settings()


@router.get("/history", response_model=list[dict])
def get_chat_history(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının geçmiş sohbet kayıtlarını getirir (en eskiden en yeniye doğru)."""
    messages = (
        db.query(ChatMessageDB)
        .filter(ChatMessageDB.user_id == current_user.id)
        .order_by(desc(ChatMessageDB.created_at))
        .limit(limit)
        .all()
    )
    messages.reverse()
    return [
        {
            "id": str(msg.id),
            "sender": msg.sender,
            "message": msg.message,
            "created_at": msg.created_at.isoformat() if msg.created_at else None
        }
        for msg in messages
    ]


@router.post("/", response_model=ChatResponse)
async def chat_with_ai(
    message: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    AI Director ile LangChain altyapısı üzerinden sohbet et.
    Kalıcı veritabanı hafızası kullanarak dinamik prompt beslemesi yapar.
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
            temperature=0.7
        )

        # 2. DİNAMİK BEYNİ ÇAĞIR (Cold Start & Tone Adaptation)
        full_system_prompt = build_director_system_prompt(current_user)

        # YENİ: Intent'e göre planner'dan veri çek, context'e ekle
        intent = classify_intent(message.message)
        planner_context = ""

        if intent == "breakdown":
            result = await ai_planner_agent.break_down_task(task_name=message.message)
            planner_context = f"\n\n[SİSTEM VERİSİ - alt görevler]: {result.model_dump_json()}"

        elif intent == "plan":
            open_tasks = [
                {
                    "title": t.title,
                    "description": t.description,
                    "deadline": t.due_date.isoformat() if t.due_date else None,
                }
                for t in db.query(Task).filter(
                    Task.user_id == current_user.id,
                    Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS])
                ).all()
            ]
            result = await ai_planner_agent.prioritize_tasks(tasks=open_tasks)
            planner_context = f"\n\n[SİSTEM VERİSİ - öncelik sıralaması]: {result.model_dump_json()}"

        elif intent == "motivate":
            open_tasks = [
                {"title": t.title, "description": t.description}
                for t in db.query(Task).filter(
                    Task.user_id == current_user.id,
                    Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS])
                ).all()
            ]
            result = await ai_planner_agent.get_ai_recommendations(user_tasks=open_tasks)
            planner_context = f"\n\n[SİSTEM VERİSİ - öneriler]: {result}"

        if planner_context:
            full_system_prompt += (
                "\n\nAşağıda sistemin ürettiği ham veri var. Bunu ASLA olduğu gibi "
                "kopyalama, kendi kimliğin ve tonunla yeniden yorumla:"
                + planner_context
            )

        # 3. Prompt Şablonunu Hazırla
        prompt = ChatPromptTemplate.from_messages([
            ("system", full_system_prompt),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ])

        # 4. Veritabanından geçmiş son 10 mesajı çek ve hafızaya yükle
        past_db_messages = (
            db.query(ChatMessageDB)
            .filter(ChatMessageDB.user_id == current_user.id)
            .order_by(desc(ChatMessageDB.created_at))
            .limit(10)
            .all()
        )
        past_db_messages.reverse()

        history = InMemoryChatMessageHistory()
        for msg in past_db_messages:
            if msg.sender == "human":
                history.add_user_message(msg.message)
            elif msg.sender == "ai":
                history.add_ai_message(msg.message)

        def get_session_history(session_id: str) -> InMemoryChatMessageHistory:
            return history

        chain = prompt | llm
        chain_with_history = RunnableWithMessageHistory(
            chain,
            get_session_history,
            input_messages_key="input",
            history_messages_key="history",
        )

        # 5. Modeli Tetikle
        ai_message = chain_with_history.invoke(
            {"input": message.message},
            config={"configurable": {"session_id": str(current_user.id)}},
        )
        response_text = ai_message.content

        # 6. Mesajları kalıcı olması için veritabanına kaydet
        user_db_message = ChatMessageDB(
            user_id=current_user.id,
            sender="human",
            message=message.message
        )
        ai_db_message = ChatMessageDB(
            user_id=current_user.id,
            sender="ai",
            message=response_text
        )
        db.add(user_db_message)
        db.add(ai_db_message)
        db.commit()

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