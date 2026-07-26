from datetime import datetime, timezone
import pytest
from unittest.mock import patch, MagicMock

from app.schemas.report import ReportContent, Confidence
from app.services.weekly_report_aggregator import aggregate_weekly_metrics

# Mock DB session and query objects
@pytest.fixture
def mock_db():
    db = MagicMock()
    # Let any filter/join/count chain return 0 or empty list
    def _mock_query_methods(*args, **kwargs):
        mock_q = MagicMock()
        mock_q.count.return_value = 0
        mock_q.all.return_value = []
        mock_q.filter.return_value = mock_q
        mock_q.join.return_value = mock_q
        return mock_q
    
    db.query.return_value = _mock_query_methods()
    return db

def test_aggregate_weekly_metrics_empty(mock_db):
    """Eğer hiç veri yoksa sıfır/boş değerler döndürmeli"""
    
    metrics = aggregate_weekly_metrics(user_id="fake-uuid", db=mock_db)
    
    assert metrics["tasks"]["total_created"] == 0
    assert metrics["tasks"]["completed"] == 0
    assert metrics["tasks"]["completion_rate_percent"] == 0.0
    
    assert metrics["focus"]["total_minutes"] == 0
    assert metrics["focus"]["sessions_count"] == 0
    assert metrics["focus"]["most_productive_day"] is None
    
    assert metrics["wellbeing"]["average_mood_score_out_of_5"] == 0.0
    assert metrics["wellbeing"]["average_energy_score_out_of_5"] == 0.0
    assert metrics["wellbeing"]["days_logged"] == 0
    
    assert metrics["habits"]["tracked_habits_count"] == 0
    assert metrics["habits"]["completions_this_week"] == 0
    assert metrics["habits"]["estimated_completion_rate_percent"] == 0.0

@patch('langchain_core.runnables.RunnableSequence.invoke')
@patch('app.agents.weekly_report_agent.get_report_llm')
def test_generate_weekly_report_fallback(mock_get_llm, mock_invoke):
    """LLM hata verirse güvenli fallback dönmeli."""
    mock_llm_instance = MagicMock()
    mock_get_llm.return_value = mock_llm_instance
    mock_llm_instance.with_structured_output.return_value = MagicMock()
    
    mock_invoke.side_effect = Exception("API Error")
    
    from app.agents.weekly_report_agent import generate_weekly_report_content
    
    metrics = {"test": "data"}
    report = generate_weekly_report_content(metrics)
    
    assert report.confidence.level == "low"
    assert "Haftalık rapor şu an oluşturulamadı" in report.summary


