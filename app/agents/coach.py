import os
import logging
from typing import Optional, List, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory

# Loglama yapılandırması
logger = logging.getLogger(__name__)

# 1. Google Gemini Model Bağlantısı
llm = ChatGoogleGenerativeAI(
    model="gemini-flash-latest",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.7
)

# 2. Yardımcı Fonksiyonlar (Skor, Alışkanlık ve Biyolojik Bağlam Yönetimi)
def determine_score_band(score: Optional[float]) -> str:
    """Kullanıcının skoruna göre koçluk stratejisi ve tonunu belirler."""
    if score is None:
        return "Nötr ve dengeli bir moddasın. Kullanıcının mevcut durumunu anlamaya çalış."
    
    if score >= 80:
        return (
            "Kullanıcının Sorumluluk Skoru YÜKSEK (80+). "
            "Ton: Teşvik edici, övgü dolu ve gelişim odaklı. "
            "Aksiyon: Kullanıcıyı kutla, başarılarını vurgula ve onu bir sonraki seviyeye taşıyacak "
            "daha büyük hedefler veya optimizasyonlar öner."
        )
    elif score >= 50:
        return (
            "Kullanıcının Sorumluluk Skoru ORTA (50-79). "
            "Ton: Dengeli, stratejik ve destekleyici. "
            "Aksiyon: İstikrarı korumaya odaklan, iyi gittiği yönleri destekle ama gelişim "
            "alanlarına yapıcı bir şekilde değin."
        )
    else:
        return (
            "Kullanıcının Sorumluluk Skoru DÜŞÜK (<50). "
            "Ton: Destekleyici, empatik ama eyleme geçirici. "
            "Aksiyon: Kullanıcıyı suçlama. Sadece küçük ve hemen uygulanabilir adımlar sun."
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

def build_user_biological_context(user_context: Optional[Dict[str, Any]]) -> str:
    """Kullanıcının anlık biyolojik/döngüsel bağlamını işler ve koç promptuna entegre eder."""
    if not user_context:
        return "Özel bir biyolojik veya döngüsel bağlam verisi bulunmuyor."
    
    is_cycle_phase = user_context.get("is_cycle_phase", False)
    if is_cycle_phase:
        return (
            "[Önemli Biyolojik Bağlam]\n"
            "Kullanıcı şu an adet dönemindedir. Biyolojik olarak enerji dalgalanmalarının ve "
            "odak kaymalarının dorukta olduğu bir süreçtedir. Sistem yükü buna göre re-kalibre edilmiştir. "
            "Koç olarak bunu anlayışla karşıla, ancak bunu bir mazeret olarak değil, sistemin optimize edeceği "
            "bir veri noktası olarak ele al. Yanıtının bir bölümünde, ileride bu takibin akıllı saat entegrasyonları "
            "ve gelişmiş biyometrik modüllerle otomatik yapılabilmesi için ekibin çalıştığını belirt ve "
            "kullanıcıya gelecekte uygulamada hangi modülü/özelliği görmek istediğini sorarak organik bir geri bildirim topla."
        )
    
    return "Standart biyolojik akış devam ediyor."

# 3. Stratejik Sistem Promptu (Forge Kişiliği + Domain Uzmanlığı + Biyolojik Bağlam)
system_prompt = """
Sen FocusForge uygulamasının resmi yapay zeka koçu olan 'Forge' isimli bir ajansın.
Görevin: Uzaktan çalışan yazılımcıların, veri bilimcilerin, öğrencilerin ve kişisel gelişim odaklı bireylerin erteleme problemlerini çözmek, görevlerini küçük parçalara ayırmak ve onlara bilimsel/teknik temelli rehberlik etmek.

Kişiliğin: Hedef odaklı, stratejik, net ve keskin sınırları olan bir karaktere sahipsin ama aynı zamanda empati yeteneğin yüksek. Boş motivasyon cümleleri kurmazsın, eyleme geçirici rasyonel, gerçekçi ve bilgi dolu tavsiyeler verirsin.

[Biyolojik ve Döngüsel Bağlam]
{biological_context}

[Alan Uzmanlığı ve Bilimsel Yaklaşım Kuralları]
- Kullanıcıdan Diyet veya Beslenme alanında bir görev/soru gelirse: Makro besin dengesi, sürdürülebilir enerji açığı ve metabolik anatomi ile konuş. Asla tıbbi teşhis koyma.
- Kullanıcıdan Antrenman alanında bir görev gelirse: Kas anatomisi, progresif yüklenme prensibi ve dinlenme fizyolojisi üzerinden rehberlik et.
- Kullanıcının 'kapsam_fobisi' veya 'dalgali enerji' profili olduğunu unutma: Büyük teorik bilgileri asla dev planlar halinde verme, tek bir mikro adıma indirge.

[Koçluk Tonu ve Stratejisi]
{score_band_instruction}

[Alışkanlık Verisi]
{habit_context}

Kullanıcıya yanıt verirken yukarıdaki stratejiyi, biyolojik bağlamı, domain uzmanlığını ve alışkanlık verilerini kullanarak kişiselleştirilmiş bir tavsiye sun.
"""

prompt_template = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])

# 4. Basit Hafıza Sistemi (Son 10 Mesajı Hatırlama)
history_store = {}

def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in history_store:
        history_store[session_id] = ChatMessageHistory()
    
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

def invoke_coach(
    session_id: str, 
    user_input: str, 
    score: Optional[float] = None, 
    habits: Optional[List[Dict[str, Any]]] = None,
    user_context: Optional[Dict[str, Any]] = None
) -> str:
    """
    Koç ajansını dışarıdan çağırmak için güvenli yardımcı fonksiyon.
    Defensive programming (try-except) kuralıyla korunmuştur.
    """
    try:
        score_instruction = determine_score_band(score)
        habit_ctx = build_habit_context(habits)
        bio_ctx = build_user_biological_context(user_context)
        
        response = forge_agent.invoke(
            {
                "input": user_input,
                "score_band_instruction": score_instruction,
                "habit_context": habit_ctx,
                "biological_context": bio_ctx
            },
            config={"configurable": {"session_id": session_id}}
        )
        return response.content
        
    except Exception as e:
        logger.error(f"Koç ajanı LLM/API çağrısında hata yakalandı: {str(e)}")
        
        return (
            "Şu an sistemde geçici bir teknik yoğunluk var, ancak bu durmamız için "
            "asla bir bahane değil. Ne yapman gerektiğini ve atman gereken adımı zaten biliyorsun. "
            "Ben tekrar tam kapasite devreye girene kadar sen o görevi tamamla. "
        )