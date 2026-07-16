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
from app.models.task import Task, TaskStatus
from app.services.auth import get_current_user
from app.schemas.chat import ChatMessage, ChatResponse
from app.schemas.task import UserContext
from app.config import get_settings

# Director (Orchestrator) motorumuzu içe aktarıyoruz
from app.agents.director import build_director_system_prompt, route_user_request
from app.agents import ai_planner_agent

# LangChain Kütüphaneleri
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory

router = APIRouter(prefix="/api/chat", tags=["AI Sohbet"])
settings = get_settings()


def _energy_int_to_level(energy: int | None) -> str:
    """1-10 aralığındaki anlık enerjiyi ai_planner_agent'ın beklediği low/medium/high'a çevirir."""
    if energy is None:
        return "medium"
    if energy <= 3:
        return "low"
    if energy <= 7:
        return "medium"
    return "high"


def _get_open_tasks(db: Session, user_id) -> list[dict]:
    """Kullanıcının açık (todo/in_progress) görevlerini planner'ın beklediği dict formatında döner."""
    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user_id,
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS])
        )
        .all()
    )
    return [
        {
            "title": t.title,
            "description": t.description,
            "deadline": t.due_date.isoformat() if t.due_date else None,
        }
        for t in tasks
    ]


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
    # Arayüzde kronolojik sıralama için mesajları ters çeviriyoruz
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
        # 1. LangChain LLM Tanımlaması (güncel Gemini Flash alias'ı)
        llm = ChatGoogleGenerativeAI(
            model="gemini-flash-latest",
            google_api_key=settings.gemini_api_key,
            temperature=0.7  # Yaratıcılık ve netlik dengesi
        )

        # 2. Anlık UserContext'i kur (mood/energy frontend'den geldiyse kullanılır)
        user_context = UserContext(
            mood=message.mood,
            energy=message.energy,
            persona=None,
        )

        # 3. YZTA-92: Mesajı doğru ajana yönlendir (Orchestrator)
        routing = route_user_request(message.message, current_user, user_context)
        target_agent = routing["target_agent"]

        # 4. DİNAMİK BEYNİ ÇAĞIR (Cold Start & Tone + Anlık Durum Adaptation)
        full_system_prompt = build_director_system_prompt(current_user, user_context)

        # Açık görevleri BİR KEZ çekiyoruz (tekrar sorgu yapmamak için branch'lerde
        # tekrar kullanılacak). Intent ne olursa olsun, Director en azından kaç açık
        # görev olduğunu bilsin — böylece "hiç görev yok" yanılgısına düşmüyor.
        open_tasks = _get_open_tasks(db, current_user.id)
        full_system_prompt += (
            f"\n\n[Bilgi: Kullanıcının şu an {len(open_tasks)} açık (tamamlanmamış) görevi var.]"
        )

        # 5. Hedef ajana göre planner'dan veri çek, context'e ekle
        planner_context = ""

        if target_agent == "architect":
            if "böl" in message.message.lower():
                result = await ai_planner_agent.break_down_task(task_name=message.message)
                planner_context = f"\n\n[SİSTEM VERİSİ - alt görevler]: {result.model_dump_json()}"
            else:
                result = await ai_planner_agent.prioritize_tasks(tasks=open_tasks)
                planner_context = f"\n\n[SİSTEM VERİSİ - öncelik sıralaması]: {result.model_dump_json()}"

        elif target_agent == "coach":
            energy_level = _energy_int_to_level(user_context.energy)
            result = await ai_planner_agent.get_ai_recommendations(
                user_tasks=open_tasks,
                user_energy_level=energy_level,
            )
            planner_context = f"\n\n[SİSTEM VERİSİ - öneriler]: {result}"

        # target_agent == "planner" (görev ekleme/listeleme) ve "director" (genel sohbet)
        # için şimdilik ek planner çağrısı yapılmıyor; Director kendi tonuyla yanıtlıyor.
        # Görev CRUD işlemleri ayrı /api/tasks endpoint'i üzerinden yürütülüyor.

        if planner_context:
            full_system_prompt += (
                "\n\nAşağıda sistemin ürettiği ham veri var. Bunu ASLA olduğu gibi "
                "kopyalama, kendi kimliğin ve tonunla yeniden yorumla:"
                + planner_context
            )

        # 6. Prompt Şablonunu Hazırla
        # LangChain, "system" mesaj metnini bir şablon gibi parse eder ve içindeki
        # { } karakterlerini değişken yer tutucusu sanır. planner_context içindeki
        # gerçek JSON verisi de { } içerdiğinden, bunları literal karakter olarak
        # korumak için kaçış (escape) yapıyoruz — aksi halde "nested replacement
        # fields" hatası alınır.
        safe_system_prompt = full_system_prompt.replace("{", "{{").replace("}", "}}")

        prompt = ChatPromptTemplate.from_messages([
            ("system", safe_system_prompt),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ])

        # 7. Veritabanından geçmiş son 10 mesajı çek ve hafızaya yükle
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

        # 8. Modeli Tetikle
        ai_message = chain_with_history.invoke(
            {"input": message.message},
            config={"configurable": {"session_id": str(current_user.id)}},
        )
        # Bazı Gemini modelleri content'i düz string yerine blok listesi
        # ([{"type": "text", "text": ...}]) olarak döndürür. Sadece metni al,
        # "extras" (base64 thought-signature vb.) alanlarını yok say.
        raw_content = ai_message.content
        if isinstance(raw_content, str):
            response_text = raw_content
        elif isinstance(raw_content, list):
            parts = []
            for block in raw_content:
                if isinstance(block, str):
                    parts.append(block)
                elif isinstance(block, dict):
                    parts.append(block.get("text", ""))
            response_text = "".join(parts)
        else:
            response_text = str(raw_content)

        # 9. Mesajları kalıcı olması için veritabanına kaydet
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
            agent_name=target_agent.capitalize(),
            suggestions=[],
        )

    except Exception as e:
        error_text = str(e)

        # Gemini günlük/dakikalık kota sınırına takıldıysa (429), çıplak 500 hatası
        # yerine Director'ın kendi tonuna uygun, LLM'e hiç gitmeyen sabit bir mesaj
        # dönüyoruz. Böylece kullanıcı deneyimi kırılmıyor, persona korunuyor.
        if "RESOURCE_EXHAUSTED" in error_text or "429" in error_text:
            fallback_message = (
                "Şu an sistem kapasitesi dolu, ama bu senin için bir bahane değil. "
                "Az önce konuştuğumuz o tek kritik görevi zihninde tut ve birkaç dakika "
                "içinde tekrar dene; yapabileceğini biliyorum — ben burada, tam olarak aynı yerde olacağım."
            )
            return ChatResponse(
                response=fallback_message,
                agent_name="Director",
                suggestions=[],
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LangChain yanıt üretemedi: {error_text}",
        )