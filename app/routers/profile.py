from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.database import get_db
from app.models.user import User
from app.services.auth import get_current_user
from app.schemas.profile import UserProfileData
from app.services.ai_profiler_service import generate_ai_profile
from app.config import get_settings

router = APIRouter(prefix="/api/profile", tags=["AI Profile"])
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=UserProfileData)
def trigger_profile_generation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Kullanıcının geçmiş sohbet, görev ve yansıma (reflection) verilerini analiz edip
    Yapay Zeka (Uzun Süreli Hafıza) Profilini günceller ve geri döner.
    Genelde Frontend tarafından periyodik olarak (Örn: Haftada bir) veya
    kullanıcı "Profilimi Güncelle" butonuna bastığında çağrılmalıdır.
    """
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API anahtarı ayarlanmamış."
        )
        
    try:
        profile = generate_ai_profile(db, current_user)
        return profile
    except Exception as e:
        logger.error(f"Profil üretim hatası: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profil üretilirken hata oluştu: {str(e)}"
        )


@router.get("/", response_model=UserProfileData)
def get_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Kullanıcının var olan kalıcı yapay zeka profilini getirir.
    Henüz üretilmemişse 404 döner.
    """
    profile_dict = current_user.ai_profile or {}
    user_profile = profile_dict.get("user_profile")
    
    if not user_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Henüz AI profili oluşturulmamış. Lütfen önce generate endpoint'ini çağırın."
        )
        
    return user_profile
