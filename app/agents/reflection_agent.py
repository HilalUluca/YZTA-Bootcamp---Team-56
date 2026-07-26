import os
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from sqlalchemy.orm import Session

from app.models.focus_session import Reflection, MoodLevel
from app.config import get_settings

logger = logging.getLogger(__name__)

# Pydantic Schemas for Structured Output
class SentimentResult(BaseModel):
    label: str = Field(description="The sentiment label: 'positive', 'neutral', or 'negative'")
    score: float = Field(description="The sentiment score between -1.0 (very negative) and 1.0 (very positive)")

class WeeklySummaryComment(BaseModel):
    comment: str = Field(description="A short, encouraging and analytical human-readable comment about the user's weekly mood and energy trend.")

# Setup LLM
llm = ChatGoogleGenerativeAI(
    model="gemini-flash-latest",
    google_api_key=os.getenv("GEMINI_API_KEY") or "dummy_key_for_tests",
    temperature=0.3
)

# Chains
sentiment_llm = llm.with_structured_output(SentimentResult)
comment_llm = llm.with_structured_output(WeeklySummaryComment)

def analyze_sentiment(text: str) -> Dict[str, Any]:
    """
    LLM kullanarak metnin duygu analizini (sentiment) yapar.
    """
    if not text or not text.strip():
        return {"label": "neutral", "score": 0.0}

    prompt = f"Analyze the sentiment of the following reflection text:\n\n{text}"
    try:
        result = sentiment_llm.invoke(prompt)
        return {"label": result.label, "score": result.score}
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        return {"label": "neutral", "score": 0.0}

def get_weekly_summary(user_id: str, db: Session) -> Dict[str, Any]:
    """
    Son 7 gün ve önceki 7 günün verilerini çeker, trend analizini çıkarır ve LLM ile yorumlar.
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    current_week_start = today_start - timedelta(days=7)
    previous_week_start = current_week_start - timedelta(days=7)

    # Son 7 gün verileri
    current_week_reflections = db.query(Reflection).filter(
        Reflection.user_id == user_id,
        Reflection.date >= current_week_start,
        Reflection.date < today_start
    ).all()

    # Önceki 7 gün verileri
    previous_week_reflections = db.query(Reflection).filter(
        Reflection.user_id == user_id,
        Reflection.date >= previous_week_start,
        Reflection.date < current_week_start
    ).all()

    def _calc_stats(reflections: List[Reflection]):
        if not reflections:
            return {"mood_avg": 0.0, "energy_avg": 0.0, "negative_ratio": 0.0}
        
        mood_scores = {
            MoodLevel.GREAT: 5.0,
            MoodLevel.GOOD: 4.0,
            MoodLevel.NEUTRAL: 3.0,
            MoodLevel.LOW: 2.0,
            MoodLevel.BAD: 1.0
        }
        
        total_mood = sum(mood_scores.get(r.mood, 3.0) for r in reflections)
        total_energy = sum(r.energy_level for r in reflections)
        
        negative_count = sum(
            1 for r in reflections 
            if (r.ai_analysis or {}).get("sentiment", {}).get("label") == "negative"
        )
                
        count = len(reflections)
        return {
            "mood_avg": total_mood / count,
            "energy_avg": total_energy / count,
            "negative_ratio": negative_count / count
        }

    current_stats = _calc_stats(current_week_reflections)
    previous_stats = _calc_stats(previous_week_reflections)

    mood_diff = current_stats["mood_avg"] - previous_stats["mood_avg"]
    energy_diff = current_stats["energy_avg"] - previous_stats["energy_avg"]

    # LLM Yorumu Üretimi
    if len(current_week_reflections) > 0:
        prompt = f"""
        Kullanıcının haftalık yansıma (reflection) özet istatistikleri aşağıdadır:
        - Mevcut Hafta Mood Ortalaması: {current_stats['mood_avg']:.2f}/5.0 (Önceki haftaya göre fark: {mood_diff:+.2f})
        - Mevcut Hafta Enerji Ortalaması: {current_stats['energy_avg']:.2f}/5.0 (Önceki haftaya göre fark: {energy_diff:+.2f})
        - Negatif Duygu Oranı: %{current_stats['negative_ratio']*100:.0f}
        
        Bu verilere dayanarak kullanıcıya (sen diliyle) motive edici, destekleyici veya ufak uyarılar barındıran kısa, 1-2 cümlelik empati dolu bir koçluk yorumu yaz.
        """
        try:
            result = comment_llm.invoke(prompt)
            comment = result.comment
        except Exception as e:
            logger.error(f"Weekly comment generation failed: {e}")
            comment = "Bu hafta verilerin analiz edildi, koçluk yorumu şu an oluşturulamadı."
    else:
        comment = "Bu hafta için yeterli yansıma verin bulunmuyor, günlük check-in yapmayı unutma!"

    return {
        "current_week": current_stats,
        "previous_week": previous_stats,
        "mood_diff": round(mood_diff, 2),
        "energy_diff": round(energy_diff, 2),
        "comment": comment
    }

def generate_coach_triggers(summary_data: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Haftalık özet verisinden kural tabanlı koç uyarıları (warning/critical) üretir.
    """
    settings = get_settings()
    triggers = []
    
    current_stats = summary_data.get("current_week", {})
    if not current_stats or current_stats.get("mood_avg") == 0:
        return triggers

    negative_ratio = current_stats.get("negative_ratio", 0.0)
    energy_diff = summary_data.get("energy_diff", 0.0)
    mood_avg = current_stats.get("mood_avg", 0.0)
    energy_avg = current_stats.get("energy_avg", 0.0)

    if mood_avg <= settings.critical_mood_avg and energy_avg <= settings.critical_energy_avg:
        triggers.append({
            "level": "critical",
            "message": f"Son 7 günde mood ({mood_avg:.1f}) ve enerji ({energy_avg:.1f}) kritik seviyede düşük!"
        })

    if negative_ratio >= settings.warning_negative_sentiment_ratio:
        triggers.append({
            "level": "warning",
            "message": f"Son 7 günde yansımalarındaki negatif duygu oranı yüksek (%{negative_ratio*100:.0f})."
        })

    if energy_diff <= -settings.warning_energy_drop:
        triggers.append({
            "level": "warning",
            "message": f"Enerji ortalaması önceki haftaya göre belirgin şekilde düştü ({energy_diff:+.1f} puan)."
        })

    if not triggers:
        triggers.append({
            "level": "info",
            "message": "Haftalık değerlerin stabil, endişe verici bir durum yok."
        })

    return triggers
