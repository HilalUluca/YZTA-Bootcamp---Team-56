import os
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Union, List, Optional

from sqlalchemy.orm import Session
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

from app.models.user import User
from app.models.focus_session import Reflection, MoodLevel
from app.models.habit import HabitLog, Habit

# 1. Google Gemini Model Bağlantısı
llm = ChatGoogleGenerativeAI(
    model="gemini-flash-latest",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.4
)

# 2. Sage (Analist Ajanı) Sistem Promptu
sage_prompt = PromptTemplate.from_template(
    "Sen FocusForge'un Veri Analisti ve Yaşam Koçu 'Sage' (Bilge) ajansın.\n"
    "Görev: Kullanıcının ruh hali ile alışkanlık tamamlama performansı arasındaki gizli ilişkiyi (korelasyonu) bulmak.\n\n"
    "Kullanıcının son {days} günlük verisi:\n"
    "{data}\n\n"
    "(Not: mood_score 1-5 arasıdır. 5=Harika, 1=Kötü)\n\n"
    "Sage olarak bu veriyi incele ve kullanıcıya, alışkanlıkları ve ruh hali arasındaki ilişkiyi "
    "gösteren, onu motive edecek ve stratejik davranmasını sağlayacak **maksimum 2 cümlelik** derin bir içgörü yaz."
)

sage_chain = sage_prompt | llm

# 3. Duygu Analizi (Sentiment Analysis) Promptu
sentiment_prompt = PromptTemplate.from_template(
    "Sen uzman bir psikolog ve yaşam koçusun.\n"
    "Aşağıda kullanıcının günlük yansıma (reflection) verileri bulunmaktadır:\n\n"
    "Ruh Hali (Mood): {mood}\n"
    "Kazanımlar (Wins): {wins}\n"
    "Gelişim Alanları (Improvements): {improvements}\n\n"
    "Görev: Bu verileri analiz ederek kullanıcının genel duygu durumunu değerlendir.\n"
    "Önemli Not: 'Improvements' alanı gelişim odaklıdır, doğrudan negatif olarak sayılmamalıdır.\n\n"
    "Lütfen **sadece** aşağıdaki yapıya tam uyan geçerli bir JSON dön (başka hiçbir metin veya markdown ekleme):\n"
    "{{\n"
    '  "overall_sentiment": "positive",\n'
    '  "score": 0.8,\n'
    '  "confidence": 0.9,\n'
    '  "signals": ["mood iyi görünüyor", "gelişim hedefleri net"],\n'
    '  "recommended_action": "Aynı ivmeyle devam et."\n'
    "}}\n"
    "Değerler (overall_sentiment: positive|neutral|negative, score: -1.0 ile 1.0 arası, confidence: 0.0 ile 1.0 arası) kullanıcının durumuna göre değişmelidir."
)

sentiment_chain = sentiment_prompt | llm

def analyze_sentiment(
    mood: Union[str, MoodLevel, None], 
    wins: Union[str, List[str], None], 
    improvements: Union[str, List[str], None]
) -> Dict[str, Any]:
    """
    Kullanıcının reflection verilerinden duygu analizi üretir.
    Hata durumlarında güvenli bir fallback döner.
    """
    mood_str = str(mood.value) if isinstance(mood, MoodLevel) else str(mood or "Belirtilmemiş")
    
    def _format_list(item) -> str:
        if not item:
            return "Yok"
        if isinstance(item, list):
            return ", ".join([str(i) for i in item])
        return str(item)
        
    wins_str = _format_list(wins)
    improvements_str = _format_list(improvements)
    
    fallback_response = {
        "overall_sentiment": "neutral",
        "score": 0.0,
        "confidence": 0.0,
        "signals": ["Veri yetersiz veya analiz edilemedi."],
        "recommended_action": "Günlük yansımalarını doldurmaya devam et."
    }
    
    if mood_str == "Belirtilmemiş" and wins_str == "Yok" and improvements_str == "Yok":
        return fallback_response
        
    try:
        response = sentiment_chain.invoke({
            "mood": mood_str,
            "wins": wins_str,
            "improvements": improvements_str
        })
        
        raw_content = response.content.strip()
        if raw_content.startswith("```json"):
            raw_content = raw_content[7:]
        if raw_content.startswith("```"):
            raw_content = raw_content[3:]
        if raw_content.endswith("```"):
            raw_content = raw_content[:-3]
            
        parsed_json = json.loads(raw_content.strip())
        
        for key in ["overall_sentiment", "score", "confidence", "signals", "recommended_action"]:
            if key not in parsed_json:
                raise ValueError(f"Eksik anahtar: {key}")
                
        return parsed_json
    except Exception as e:
        print(f"Sentiment Analysis Error: {e}")
        return fallback_response


# Mood Enum -> Sayısal Skor
MOOD_SCORES = {
    MoodLevel.GREAT: 5,
    MoodLevel.GOOD: 4,
    MoodLevel.NEUTRAL: 3,
    MoodLevel.LOW: 2,
    MoodLevel.BAD: 1
}

def _fetch_mood_data(user_id: str, db: Session, start_date: datetime) -> dict:
    """Veritabanından kullanıcının mood verilerini çeker."""
    reflections = (
        db.query(Reflection)
        .filter(
            Reflection.user_id == user_id,
            Reflection.date >= start_date
        )
        .all()
    )
    mood_by_date = {}
    for r in reflections:
        date_str = r.date.strftime("%Y-%m-%d")
        mood_by_date[date_str] = MOOD_SCORES.get(r.mood, 3)
    return mood_by_date

def _fetch_latest_reflection(user_id: str, db: Session, start_date: datetime) -> Optional[Reflection]:
    """Belirtilen tarih aralığındaki en güncel reflection kaydını getirir."""
    return (
        db.query(Reflection)
        .filter(
            Reflection.user_id == user_id,
            Reflection.date >= start_date
        )
        .order_by(Reflection.date.desc())
        .first()
    )

def _fetch_habit_data(user_id: str, db: Session, start_date: datetime) -> dict:
    """Veritabanından kullanıcının alışkanlık tamamlama verilerini çeker."""
    habit_logs = (
        db.query(HabitLog)
        .join(Habit)
        .filter(
            Habit.user_id == user_id,
            HabitLog.completed_at >= start_date
        )
        .all()
    )
    habits_by_date = {}
    for log in habit_logs:
        date_str = log.completed_at.strftime("%Y-%m-%d")
        habits_by_date[date_str] = habits_by_date.get(date_str, 0) + 1
    return habits_by_date


def run_mood_habit_analysis(user: User, db: Session, days: int = 30) -> Dict[str, Any]:
    """
    Sage ajanı tarafından çalıştırılan ana analiz fonksiyonu.
    Korelasyon verilerini toplar ve AI içgörüsüyle beraber döner.
    """
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    # Verileri topla
    mood_by_date = _fetch_mood_data(user.id, db, start_date)
    habits_by_date = _fetch_habit_data(user.id, db, start_date)
    
    # Zaman serisi oluştur
    time_series = []
    valid_days = []
    
    for i in range(days):
        current = start_date + timedelta(days=i)
        date_str = current.strftime("%Y-%m-%d")
        
        mood = mood_by_date.get(date_str, None)
        habits_completed = habits_by_date.get(date_str, 0)
        
        day_data = {
            "date": date_str,
            "mood_score": mood,
            "habits_completed": habits_completed
        }
        
        time_series.append(day_data)
        
        if mood is not None:
            valid_days.append(day_data)
            
    # LLM İçgörüsü
    insight = "Yeterli veri bulunmadığı için Sage henüz bir analiz yapamıyor."
    
    if len(valid_days) >= 3:
        try:
            data_json = json.dumps(valid_days, ensure_ascii=False)
            response = sage_chain.invoke({"days": days, "data": data_json})
            insight = response.content.strip()
        except Exception as e:
            print(f"Sage Agent Error: {e}")
            insight = "Analiz ajanı (Sage) şu an içgörü oluşturamıyor."

    # Duygu Analizi (Sentiment Analysis)
    sentiment_data = None
    latest_reflection = _fetch_latest_reflection(user.id, db, start_date)
    
    if latest_reflection:
        sentiment_data = analyze_sentiment(
            mood=latest_reflection.mood,
            wins=latest_reflection.wins,
            improvements=latest_reflection.improvements
        )
    else:
        sentiment_data = {
            "overall_sentiment": "neutral",
            "score": 0.0,
            "confidence": 0.0,
            "signals": ["Bu dönem için herhangi bir yansıma kaydı bulunamadı."],
            "recommended_action": "Nasıl hissettiğini kaydetmeye başla."
        }

    return {
        "period_days": days,
        "agent": "Sage",
        "insight": insight,
        "sentiment": sentiment_data,
        "time_series": time_series
    }
