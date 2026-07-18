"""Chat API şemaları."""

from typing import Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Kullanıcıdan gelen sohbet mesajı."""
    message: str = Field(min_length=1, max_length=2000)
    context: Optional[str] = Field(
        default=None,
        description="Opsiyonel bağlam: 'motivation', 'planning', 'reflection'"
    )
    # YENİ EKLENEN: UserContext (mood/energy) için opsiyonel alanlar.
    # Frontend doldurmazsa None kalır, Director "Bilinmiyor" olarak yorumlar.
    mood: Optional[str] = Field(
        default=None,
        description="Anlık ruh hali (örn: stresli, yorgun, enerjik)"
    )
    energy: Optional[int] = Field(
        default=None, ge=1, le=10,
        description="1-10 arası anlık enerji seviyesi"
    )


class ChatResponse(BaseModel):
    """AI koçtan dönen sohbet yanıtı."""
    response: str
    agent_name: str  # Hangi ajan cevap verdi (Forge, Architect, Sage)
    suggestions: list[str] = []  # Varsa önerilen takip aksiyonları