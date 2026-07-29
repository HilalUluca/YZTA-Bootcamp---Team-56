"""
Cihaz (telefon) kullanım verisi modeli — YZTA-151.

Gerçek telefon API'lerine (Screen Time / Digital Wellbeing) bağlanmak yerine
istemci simüle edilmiş veriyi POST /api/device/sync ile gönderir; analiz
tarafı bu tabloyu okur. Veri kaynağı simülasyon da olsa gerçek veri de olsa
şema aynıdır — ileride gerçek entegrasyona geçilirse sadece besleyen taraf
değişir.

Kullanıcı + gün başına TEK satır tutulur (unique constraint). Aynı gün için
tekrar sync gelirse satır güncellenir; böylece "bugünü birkaç kez senkronla"
akışı veriyi çoğaltmaz.
"""

import uuid
from datetime import date as date_type, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DeviceUsage(Base):
    """Bir kullanıcının bir güne ait cihaz kullanım özeti."""

    __tablename__ = "device_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_device_usage_user_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Hangi güne ait (saat bilgisi yok; gün bazlı özet).
    date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)

    # Toplam ekran süresi (saat). Örn: 6.5
    screen_time_hours: Mapped[float] = mapped_column(Float, default=0.0)

    # Uygulama bazlı kırılım (saat). Örn: {"instagram": 2.1, "youtube": 1.5}
    screen_time_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)

    # Saat bazlı kullanım: {"14": {"youtube": 30, "tiktok": 25}}
    # Dış anahtar günün saati ("0"-"23"), iç değerler o saatte uygulamada
    # geçirilen DAKİKA. Boşa giden zamanı saat aralığına oturtmak için gerekli.
    hourly_usage: Mapped[dict] = mapped_column(JSON, default=dict)

    # Sağlık sinyalleri
    step_count: Mapped[int] = mapped_column(Integer, default=0)
    sleep_hours: Mapped[float] = mapped_column(Float, default=0.0)

    # Takvim etkinlikleri: [{"title": "Ders", "start": "09:00", "end": "10:30"}]
    # Otomatik plan bu saatleri dolu kabul edip üzerine görev koymaz.
    calendar_events: Mapped[list] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
