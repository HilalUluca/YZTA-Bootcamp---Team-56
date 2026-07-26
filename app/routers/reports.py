import time
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.auth import get_current_user
from app.schemas.report import WeeklyReportResponse
from app.services.weekly_report_aggregator import aggregate_weekly_metrics
from app.agents.weekly_report_agent import generate_weekly_report_content

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/weekly", response_model=WeeklyReportResponse)
def get_weekly_report(
    endDate: Optional[str] = Query(None, description="ISO format date string (YYYY-MM-DD) to calculate the previous 7 days from."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Kullanıcının son 7 gününe (veya endDate ile belirtilen tarihten önceki 7 güne) ait
    verilerini toplayıp yapay zeka ile kişiselleştirilmiş bir rapor üretir.
    """
    end_date_obj = None
    if endDate:
        try:
            end_date_obj = datetime.fromisoformat(endDate.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid endDate format. Please use YYYY-MM-DD or ISO 8601 format."
            )

    start_time = time.time()
    
    # 1. Metrikleri Topla
    metrics = aggregate_weekly_metrics(user_id=current_user.id, db=db, end_date=end_date_obj)
    
    # 2. LLM üzerinden rapor üret
    report_content = generate_weekly_report_content(metrics)
    
    latency_ms = int((time.time() - start_time) * 1000)

    # 3. Sonucu Dön
    return WeeklyReportResponse(
        period=metrics.pop("period"), # Period'u metrics içinden ayırıyoruz
        metrics=metrics,
        report=report_content,
        modelMeta={
            "provider": "Google",
            "model": "gemini-flash-latest",
            "latencyMs": latency_ms
        }
    )
