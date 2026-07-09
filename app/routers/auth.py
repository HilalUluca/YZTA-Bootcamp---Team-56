"""
Kimlik doğrulama (Authentication) API endpoint'leri.

Endpoints:
    POST /api/auth/register  → Yeni kullanıcı kaydı
    POST /api/auth/login     → Giriş yap, JWT token al
    GET  /api/auth/me        → Mevcut kullanıcı bilgilerini getir
    PUT  /api/auth/onboarding → İlk kayıtta AI profili oluştur (cold-start)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserRegister,
    UserLogin,
    Token,
    UserResponse,
    OnboardingData,
)
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["Kimlik Doğrulama"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """
    Yeni kullanıcı kaydı.
    """
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu email adresi zaten kayıtlı",
        )

    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu kullanıcı adı zaten alınmış",
        )

    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
        preferences={"theme": "dark", "notifications": True},
        ai_profile={},
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Kullanici girisi.
    """
    user = db.query(User).filter(User.username == user_data.username).first()

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı adı veya şifre hatalı",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesap devre dışı",
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username}
    )

    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Giriş yapmış kullanıcının bilgilerini döndürür.
    """
    return current_user


@router.put("/onboarding", response_model=UserResponse)
def complete_onboarding(
    data: OnboardingData,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    İlk kayıt sonrası kullanıcı profilini oluşturur (cold-start çözümü).
    Director ajanı için gereken tüm biyolojik ve psikolojik verileri haritalar.
    """
    current_user.ai_profile = {
        # Biyolojik ve Demografik Veriler (Director için Kritik)
        "age": getattr(data, "age", None),
        "profession": getattr(data, "profession", "Belirtilmemiş"),
        "sleep_pattern": getattr(data, "sleep_pattern", "Belirtilmemiş"),
        "average_screen_time": getattr(data, "average_screen_time", "Belirtilmemiş"),
        
        # Hedef ve Psikolojik Veriler
        "primary_goals": getattr(data, "primary_goals", getattr(data, "goals", [])),
        "weaknesses": getattr(data, "weaknesses", []),
        "hobbies": getattr(data, "hobbies", []),
        "biggest_challenge": getattr(data, "biggest_challenge", "Belirtilmemiş"),
        
        # Zaman ve Teknik Veriler
        "routine_hours_per_day": getattr(data, "routine_hours_per_day", "Belirtilmemiş"),
        "work_hours": {
            "start": getattr(data, "work_hours_start", None),
            "end": getattr(data, "work_hours_end", None),
        },
        "preferred_technique": getattr(data, "preferred_technique", None),
        
        "onboarding_completed": True,
    }

    db.commit()
    db.refresh(current_user)

    return current_user