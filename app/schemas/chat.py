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


class ChatResponse(BaseModel):
    """AI koçtan dönen sohbet yanıtı."""
    response: str
    agent_name: str  # Hangi ajan cevap verdi (Forge, Architect, Sage)
    suggestions: list[str] = []  # Varsa önerilen takip aksiyonları
