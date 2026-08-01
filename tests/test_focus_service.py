import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone, timedelta
import uuid

from app.models.focus_session import FocusSession
from app.services.focus_service import get_focus_summary_text
from app.agents.director import build_director_system_prompt
from app.models.user import User

@pytest.fixture
def mock_db():
    db = MagicMock()
    return db

def test_get_focus_summary_text_empty(mock_db):
    user_id = uuid.uuid4()
    
    mock_q = MagicMock()
    mock_q.all.return_value = []
    mock_q.scalar.return_value = 0
    mock_q.filter.return_value = mock_q
    
    mock_db.query.return_value = mock_q
    
    summary = get_focus_summary_text(mock_db, user_id)
    assert "Bugün henüz pomodoro seansı bulunmuyor." in summary
    assert "Küçük bir 25dk odak seansı ile başlayabilirsin." in summary

def test_get_focus_summary_text_with_data(mock_db):
    user_id = uuid.uuid4()
    
    query_call_count = 0
    def mock_query(model):
        nonlocal query_call_count
        query_call_count += 1
        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        
        if query_call_count == 1:
            # First call is FocusSession for today
            s1 = FocusSession(user_id=user_id, duration_minutes=30, productivity_rating=4)
            s2 = FocusSession(user_id=user_id, duration_minutes=20, productivity_rating=5)
            mock_q.all.return_value = [s1, s2]
        elif query_call_count == 2:
            # Second call is func.count for this week
            mock_q.scalar.return_value = 5
        elif query_call_count == 3:
            # Third call is func.count for last week
            mock_q.scalar.return_value = 4
            
        return mock_q
            
    mock_db.query.side_effect = mock_query
    
    summary = get_focus_summary_text(mock_db, user_id)
    assert "Bugün 2 pomodoro seansı yaptın (toplam 50dk)." in summary
    assert "Verimlilik: 4.5/5." in summary
    assert "Bu hafta toplam 5 seans" in summary
    assert "geçen haftaya göre %25 artış" in summary

def test_director_prompt_includes_focus_summary(mock_db):
    user_id = uuid.uuid4()
    user = User(id=user_id, username="testuser", email="test@test.com")
    
    # Empty data
    mock_q = MagicMock()
    mock_q.all.return_value = []
    mock_q.scalar.return_value = 0
    mock_q.filter.return_value = mock_q
    mock_db.query.return_value = mock_q
    
    prompt = build_director_system_prompt(user, None, mock_db)
    assert "Odak Özeti: Bugün henüz pomodoro seansı bulunmuyor." in prompt

def test_director_prompt_without_db():
    user_id = uuid.uuid4()
    user = User(id=user_id, username="testuser", email="test@test.com")
    prompt = build_director_system_prompt(user, None, None)
    assert "Odak Özeti: Odak verisi yüklenemedi." in prompt
