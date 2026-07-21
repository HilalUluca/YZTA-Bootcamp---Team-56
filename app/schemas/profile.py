from typing import Literal, List
from pydantic import BaseModel, Field


class Goals(BaseModel):
    short_term: List[str] = Field(default_factory=list, description="Kullanıcının kısa vadeli hedefleri (ör. bu hafta/ay yapılacaklar).")
    long_term: List[str] = Field(default_factory=list, description="Kullanıcının uzun vadeli büyük hedefleri (ör. kariyer, büyük projeler).")


class UserProfileData(BaseModel):
    """Yapay Zekanın çıkardığı kalıcı kullanıcı profili (Long-Term Memory)."""
    
    profile_version: str = Field(default="1.0", description="Profilin sürüm formatı.")
    generated_at: str = Field(description="Profilin oluşturulduğu tarih (ISO 8601).")
    confidence: Literal["high", "medium", "low", "unknown"] = Field(description="Yapay zekanın bu profili çıkarırken verilere ne kadar güvendiği.")
    
    traits: List[str] = Field(description="Kullanıcının çalışma ve kişilik özellikleri (ör. 'Detaycı', 'Gece kuşu').")
    goals: Goals = Field(description="Kullanıcının belirlediği hedefler.")
    work_patterns: str = Field(description="Kullanıcının genel çalışma stili (örn. 'Sabahları daha enerjik, genelde kısa seanslar tercih ediyor.').")
    risk_signals: List[str] = Field(description="Kullanıcının tükenmişlik, erteleme gibi risk taşıdığı konular.")
    
    coaching_preferences: str = Field(description="Kullanıcının ne tür geri bildirim ve koçluk stilinden hoşlandığı.")
    personalization_hints: List[str] = Field(description="AI'a bu kullanıcıyla konuşurken dikkat etmesi gereken özel ipuçları.")
    
    evidence: str = Field(description="Profilin hangi veri havuzundan (Örn: X görev, Y yansıma) çıkarıldığının kısa bir özeti.")
    last_updated_from_range: str = Field(description="Profilin analiz ettiği tarih aralığı (Örn: 2026-07-01 to 2026-07-21).")
