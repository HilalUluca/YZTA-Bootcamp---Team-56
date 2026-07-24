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

    - Email ve kullanıcı adı benzersiz olmalı
    - Şifre en az 6 karakter
    - Başarılı kayıtta kullanıcı bilgileri döner (şifre hariç)
    """
    # Email kontrolü
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu email adresi zaten kayıtlı",
        )

    # Kullanıcı adı kontrolü
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu kullanıcı adı zaten alınmış",
        )

    # Yeni kullanıcı oluştur
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

    username ve password ile giris yap, JWT token al.
    Aldigi tokeni Authorize butonuna yapistir.
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

    # Token oluştur
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username}
    )

    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Giriş yapmış kullanıcının bilgilerini döndürür.
    Token gerektirir.
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

    Director Agent'ın 1. günden itibaren sert, rasyonel ve veriye dayalı 
    analizler (uyku, ekran süresi, zayıflıklar) yapabilmesi için gerekli 
    tüm biyolojik ve psikolojik verileri alır.
    """
    # Gelen veriyi dict'e çevirip tüm alanları ai_profile'a kaydet
    onboarding_dict = data.model_dump(exclude_unset=True)
    
    # Mevcut ai_profile varsa koru, yoksa yeni oluştur
    current_profile = current_user.ai_profile or {}
    current_profile.update(onboarding_dict)
    current_profile["onboarding_completed"] = True
    
    current_user.ai_profile = current_profile

    db.commit()
    db.refresh(current_user)

    return current_user


@router.patch("/profile", response_model=UserResponse)
def update_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kullanici profilini gunceller.

    ai_profile JSON alanina yeni veriler ekler veya mevcut verileri gunceller.
    Ornek: {"profession": "Yazilimci", "sleep_pattern": "00:00-08:00"}
    """
    # Mevcut profili al ve guncelle
    current_profile = current_user.ai_profile or {}
    current_profile.update(profile_data)
    current_user.ai_profile = current_profile

    # full_name guncelleme
    if "full_name" in profile_data:
        current_user.full_name = profile_data["full_name"]

    db.commit()
    db.refresh(current_user)

    return current_user

