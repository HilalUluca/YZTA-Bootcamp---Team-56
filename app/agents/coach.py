import os
from typing import Optional, List, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory

# 1. Google Gemini Model Bağlantısı
llm = ChatGoogleGenerativeAI(
    model="gemini-flash-latest",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.7
)

# 2. Yardımcı Fonksiyonlar (Skor ve Alışkanlık Yönetimi)
def determine_score_band(score: Optional[float]) -> str:
    """Kullanıcının skoruna göre koçluk stratejisi ve tonunu belirler."""
    if score is None:
        return "Nötr ve dengeli bir moddasın. Kullanıcının mevcut durumunu anlamaya çalış."
    
    if score >= 80:
        return (
            "Kullanıcının Sorumluluk Skoru YÜKSEK (80+). "
            "Ton: Teşvik edici, övgü dolu ve gelişim odaklı. "
            "Aksiyon: Kullanıcıyı kutla, başarılarını vurgula ve onu bir sonraki seviyeye taşıyacak "
            "daha büyük hedefler (challenge) veya optimizasyonlar öner."
        )
    elif score >= 50:
        return (
            "Kullanıcının Sorumluluk Skoru ORTA (50-79). "
            "Ton: Dengeli, stratejik ve destekleyici. "
            "Aksiyon: İstikrarı korumaya odaklan, iyi gittiği yönleri destekle ama gelişim "
            "alanlarına (örneğin ufak ertelemeler) da yapıcı bir şekilde değin."
        )
    else:
        return (
            "Kullanıcının Sorumluluk Skoru DÜŞÜK (<50). "
            "Ton: Destekleyici, empatik ama eyleme geçirici. "
            "Aksiyon: Kullanıcıyı suçlama. Sadece küçük ve hemen uygulanabilir adımlar sun. "
            "Büyük hedefleri parçalara bölerek erteleme döngüsünü kırmasına yardım et."
        )

def build_habit_context(habits: Optional[List[Dict[str, Any]]]) -> str:
    """Kullanıcının alışkanlık verisini koçun anlayabileceği bir bağlama dönüştürür."""
    if not habits:
        return "Mevcut alışkanlık verisi bulunmuyor veya henüz bir alışkanlık kaydedilmemiş."
    
    context_lines = ["Kullanıcının Alışkanlık Durumu:"]
    for habit in habits:
        name = habit.get("name", "Bilinmeyen Alışkanlık")
        adherence = habit.get("adherence", "Bilinmiyor")
        streak = habit.get("streak", 0)
        status = habit.get("status", "Aktif")
        
        line = f"- {name}: Durum={status}, Uyum Oranı={adherence}, Mevcut Seri (Streak)={streak} gün."
        context_lines.append(line)
        
    return "\n".join(context_lines)

# 3. Stratejik Sistem Promptu (Forge Kişiliği)
system_prompt = """
Sen FocusForge uygulamasının resmi yapay zeka koçu olan 'Forge' isimli bir ajansın.
Görevin: Uzaktan çalışan yazılımcıların, veri bilimcilerin ve öğrencilerin erteleme problemlerini çözmek, onları motive etmek ve görevlerini küçük parçalara ayırmak.
Kişiliğin: Hedef odaklı, stratejik, net ve keskin sınırları olan bir karaktere sahipsin ama aynı zamanda empati yeteneğin yüksek. Boş motivasyon cümleleri kurmazsın, eyleme geçirici rasyonel ve gerçekçi tavsiyeler verirsin.

[Koçluk Tonu ve Stratejisi]
{score_band_instruction}

[Alışkanlık Verisi]
{habit_context}

Kullanıcıya yanıt verirken yukarıdaki stratejiyi ve alışkanlık verilerini doğrudan veya dolaylı olarak kullanarak kişiselleştirilmiş bir tavsiye sun.
"""

prompt_template = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])

# 4. Basit Hafıza Sistemi (Son 10 Mesajı Hatırlama - Conversation Buffer)
history_store = {}

def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in history_store:
        history_store[session_id] = ChatMessageHistory()
    
    # Hafızayı son 10 mesajla sınırlı tutuyoruz
    if len(history_store[session_id].messages) > 10:
        history_store[session_id].messages = history_store[session_id].messages[-10:]
        
    return history_store[session_id]

# 5. Ajanı Birleştirme ve Dışa Aktarma
chain = prompt_template | llm

forge_agent = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history"
)

def invoke_coach(session_id: str, user_input: str, score: Optional[float] = None, habits: Optional[List[Dict[str, Any]]] = None) -> str:
    """
    Koç ajansını dışarıdan çağırmak için güvenli yardımcı fonksiyon.
    Eksik veya None verilerde fallback davranışları sergiler.
    """
    score_instruction = determine_score_band(score)
    habit_ctx = build_habit_context(habits)
    
    response = forge_agent.invoke(
        {
            "input": user_input,
            "score_band_instruction": score_instruction,
            "habit_context": habit_ctx
        },
        config={"configurable": {"session_id": session_id}}
    )
    return response.content