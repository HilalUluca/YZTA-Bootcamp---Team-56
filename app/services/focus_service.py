from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.focus_session import FocusSession
from datetime import datetime, timezone, timedelta

def get_focus_summary_text(db: Session, user_id) -> str:
    now = datetime.now(timezone.utc)
    today = now.date()
    
    today_start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
    today_end = datetime.combine(today, datetime.max.time(), tzinfo=timezone.utc)
    
    this_week_start_date = today - timedelta(days=today.weekday())
    this_week_start = datetime.combine(this_week_start_date, datetime.min.time(), tzinfo=timezone.utc)
    this_week_end = datetime.combine(this_week_start_date + timedelta(days=6), datetime.max.time(), tzinfo=timezone.utc)
    
    last_week_start = this_week_start - timedelta(days=7)
    last_week_end = this_week_end - timedelta(days=7)
    
    today_sessions = db.query(FocusSession).filter(
        FocusSession.user_id == user_id,
        FocusSession.end_time.isnot(None),
        FocusSession.start_time >= today_start,
        FocusSession.start_time <= today_end
    ).all()
    
    today_count = len(today_sessions)
    today_minutes = sum(s.duration_minutes for s in today_sessions if s.duration_minutes)
    
    if today_count == 0:
        return "Bugün henüz pomodoro seansı bulunmuyor. Küçük bir 25dk odak seansı ile başlayabilirsin."
        
    rated_sessions = [s for s in today_sessions if s.productivity_rating is not None]
    if rated_sessions:
        avg_productivity = sum(s.productivity_rating for s in rated_sessions) / len(rated_sessions)
    else:
        avg_productivity = 0.0
        
    this_week_count = db.query(func.count(FocusSession.id)).filter(
        FocusSession.user_id == user_id,
        FocusSession.end_time.isnot(None),
        FocusSession.start_time >= this_week_start,
        FocusSession.start_time <= this_week_end
    ).scalar() or 0
    
    last_week_count = db.query(func.count(FocusSession.id)).filter(
        FocusSession.user_id == user_id,
        FocusSession.end_time.isnot(None),
        FocusSession.start_time >= last_week_start,
        FocusSession.start_time <= last_week_end
    ).scalar() or 0
    
    if last_week_count > 0:
        change_pct = ((this_week_count - last_week_count) / last_week_count) * 100
        change_str = f"%{abs(int(change_pct))} {'artış' if change_pct >= 0 else 'azalış'}"
    else:
        change_str = "henüz geçen hafta verisi yok"
        
    if rated_sessions:
        # Format verimlilik, drop trailing .0 if integer
        prod_str = f"{avg_productivity:g}"
        productivity_str = f"Verimlilik: {prod_str}/5."
    else:
        productivity_str = "Verimlilik: puanlanmadı."

    return f"Bugün {today_count} pomodoro seansı yaptın (toplam {today_minutes}dk). {productivity_str} Bu hafta toplam {this_week_count} seans, geçen haftaya göre {change_str}."
