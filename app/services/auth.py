"""
JWT Authentication servisi.
Token oluşturma, doğrulama ve şifre hash işlemleri.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.user import User

settings = get_settings()

# Swagger UI'da "Authorize" butonunda sadece token yapistirma kutusu cikar
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    """Şifreyi bcrypt ile hashle."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Girilen şifreyi hash ile karşılaştır."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    JWT token oluştur.
    data: token içine gömülecek veri (user_id, username)
    expires_delta: token süresi (varsayılan: config'deki değer)
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def verify_token(token: str) -> dict:
    """JWT token'ı doğrula ve içindeki veriyi döndür."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token geçersiz veya süresi dolmuş",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Mevcut kullanıcıyı token'dan çöz.
    FastAPI'nin Depends() sistemiyle her endpoint'te kullanılır.

    Kullanım:
        @router.get("/me")
        def get_me(current_user: User = Depends(get_current_user)):
            return current_user
    """
    payload = verify_token(credentials.credentials)
    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token geçersiz",
        )

    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesap devre dışı",
        )

    return user
