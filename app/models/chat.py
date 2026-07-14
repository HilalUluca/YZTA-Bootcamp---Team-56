import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Uuid, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ChatMessageDB(Base):
    """Kullanıcının yapay zeka ile yaptığı sohbet geçmişini veritabanında saklayan tablo."""

    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    sender: Mapped[str] = mapped_column(String(50), nullable=False)  # "human" veya "ai"
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
