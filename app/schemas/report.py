from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Confidence(BaseModel):
    level: str = Field(description="Confidence level of the report insights (high, medium, low).")
    reason: str = Field(description="Short reason for the confidence level (e.g. 'Sufficient data across all metrics' or 'Missing mood data').")

class ReportContent(BaseModel):
    summary: str = Field(description="Haftanın Özeti (2-4 cümle).")
    insights: List[str] = Field(description="Trend ve İçgörüler (Madde madde analizler).")
    risks: List[str] = Field(description="Riskler / Düşüş Sinyalleri (Örn. Odaklanma süresinde azalma).")
    actions: List[str] = Field(description="Gelecek Hafta için 3 Net Aksiyon Önerisi.")
    motivation: str = Field(description="Motivasyon Notu (kısa, kişisel ama abartısız).")
    confidence: Confidence

class WeeklyReportResponse(BaseModel):
    period: Dict[str, str] = Field(description="{'start': 'YYYY-MM-DD', 'end': 'YYYY-MM-DD'}")
    metrics: Dict[str, Any] = Field(description="Raw aggregated metrics used for the report")
    report: ReportContent
    modelMeta: Dict[str, Any] = Field(description="Metadata about the LLM generation")
