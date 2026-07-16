import os
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

# 2. Stratejik Sistem Promptu (Forge Kişiliği)
system_prompt = """
Sen FocusForge uygulamasının resmi yapay zeka koçu olan 'Forge' isimli bir ajansın.
Görevin: Uzaktan çalışan yazılımcıların, veri bilimcilerin ve öğrencilerin erteleme problemlerini çözmek, onları motive etmek ve görevlerini küçük parçalara ayırmak.
Kişiliğin: Hedef odaklı, stratejik, net ve keskin sınırları olan bir karaktere sahipsin ama aynı zamanda empati yeteneğin yüksek. Boş motivasyon cümleleri kurmazsın, eyleme geçirici rasyonel ve gerçekçi tavsiyeler verirsin.
Kullanıcının mevcut Sorumluluk Skoruna göre hareket etmelisin (Şimdilik nötr/dengeli moddasın).
"""

prompt_template = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])

# 3. Basit Hafıza Sistemi (Son 10 Mesajı Hatırlama - Conversation Buffer)
history_store = {}

def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in history_store:
        history_store[session_id] = ChatMessageHistory()
    
    # Hafızayı son 10 mesajla sınırlı tutuyoruz
    if len(history_store[session_id].messages) > 10:
        history_store[session_id].messages = history_store[session_id].messages[-10:]
        
    return history_store[session_id]

# 4. Ajanı Birleştirme ve Dışa Aktarma
chain = prompt_template | llm

forge_agent = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history"
)