"""
AI Sohbet (Chat) API endpoint'i.

Sprint 1'de basit chatbot olarak çalışır.
Sprint 2'de multi-agent yapısına geçecek.

Endpoint:
    POST /api/chat → AI koçla sohbet
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.chat import ChatMessage, ChatResponse
from app.services.auth import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/chat", tags=["AI Sohbet"])

settings = get_settings()


# Forge koçunun system prompt'u
FORGE_SYSTEM_PROMPT = """Sen FocusForge uygulamasının AI koçu "Forge"sun. 

Görevin:
- Kullanıcıya verimlilik ve odaklanma konusunda koçluk yapmak
- Motivasyon düştüğünde desteklemek
- Görevleri önceliklendirme ve parçalama konusunda yardım etmek
- Pomodoro, Eisenhower matrisi, 2-dakika kuralı gibi verimlilik tekniklerini önermek

Kişiliğin:
- Hedef odaklı ama empatik
- Kısa ve öz konuş, paragraflar halinde değil
- Türkçe konuş
- Kullanıcıyı "sen" diye hitap et
- Gerektiğinde sert ol ama asla kırıcı olma
- Bilimsel temelli tavsiyeler ver

Yapma:
- Tıbbi veya psikolojik tavsiye verme
- Konu dışına çıkma
- Çok uzun cevaplar verme
"""


@router.post("/", response_model=ChatResponse)
async def chat_with_ai(
    message: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    AI koç Forge ile sohbet et.

    Sprint 1: Basit Gemini API çağrısı.
    Sprint 2: LangChain multi-agent orkestrasyon.
    """

    # Gemini API key kontrolü
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API anahtarı ayarlanmamış. .env dosyasını kontrol edin.",
        )

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        
        # Model tanımını güvenli bir şekilde burada yapıyoruz
        model = genai.GenerativeModel("models/gemini-2.5-flash")

        # Kullanıcı bağlamını ekle
        user_context = ""
        if current_user.ai_profile:
            goals = current_user.ai_profile.get("goals", [])
            challenge = current_user.ai_profile.get("biggest_challenge", "")
            if goals:
                user_context += f"\nKullanıcının hedefleri: {', '.join(goals)}"
            if challenge:
                user_context += f"\nEn büyük zorluğu: {challenge}"

        user_context += f"\nKullanıcının seviyesi: {current_user.level}, XP: {current_user.total_xp}"
        user_context += f"\nSorumluluk skoru: {current_user.responsibility_score}/100"

        full_prompt = f"{FORGE_SYSTEM_PROMPT}\n{user_context}\n\nKullanıcı mesajı: {message.message}"

        # Yukarıda tanımlanan model burada tetikleniyor
        response = model.generate_content(full_prompt)

        return ChatResponse(
            response=response.text,
            agent_name="Forge",
            suggestions=[],
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI yanıt üretemedi: {str(e)}",
        )