import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

from app.services.ai_profiler_service import gather_user_signals, generate_ai_profile
from app.schemas.profile import UserProfileData, Goals
from app.models.user import User
from app.models.chat import ChatMessageDB
from app.models.focus_session import Reflection
from app.models.task import Task


@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def mock_user():
    user = User(id="fake-uuid", ai_profile={})
    return user

def test_gather_user_signals(mock_db):
    # Mock Chat Messages
    msg = ChatMessageDB(sender="human", message="Test message")
    msg.created_at = datetime.now(timezone.utc)
    
    # Mock Reflections
    ref = Reflection(mood="good", energy_level=8, wins="Did good")
    ref.date = datetime.now(timezone.utc)
    
    # Mock Tasks
    task = Task(title="Test Task", status="completed")
    task.created_at = datetime.now(timezone.utc)
    
    # Setup the mock db query chain
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    
    mock_filter = MagicMock()
    mock_query.filter.return_value = mock_filter
    
    mock_order = MagicMock()
    mock_filter.order_by.return_value = mock_order
    
    mock_limit = MagicMock()
    mock_order.limit.return_value = mock_limit
    
    # We call query 3 times. Let's make it return a list containing our mocks.
    # We can simplify by just letting all `.all()` calls return a single item list if it doesn't crash
    mock_limit.all.side_effect = [[msg], [task]]
    mock_order.all.return_value = [ref]
    
    signals = gather_user_signals(mock_db, "fake-uuid", days=14)
    
    assert "Test message" in signals
    assert "Did good" in signals
    assert "Test Task" in signals


@patch('app.services.ai_profiler_service.get_settings')
@patch('app.services.ai_profiler_service.ChatGoogleGenerativeAI')
@patch('app.services.ai_profiler_service.gather_user_signals')
def test_generate_ai_profile(mock_gather, mock_llm_class, mock_settings, mock_db, mock_user):
    mock_settings.return_value.gemini_api_key = "dummy"
    mock_gather.return_value = "Fake signals"
    
    # Create fake structured output
    fake_profile = UserProfileData(
        generated_at="",
        confidence="high",
        traits=["Analytical"],
        goals=Goals(short_term=["Fix bug"], long_term=["Be happy"]),
        work_patterns="Night owl",
        risk_signals=["None"],
        coaching_preferences="Direct",
        personalization_hints=["Hint"],
        evidence="From signals",
        last_updated_from_range=""
    )
    
    mock_llm_instance = MagicMock()
    mock_llm_class.return_value = mock_llm_instance
    
    mock_structured = MagicMock()
    mock_llm_instance.with_structured_output.return_value = mock_structured
    
    with patch('langchain_core.runnables.RunnableSequence.invoke', return_value=fake_profile):
        result = generate_ai_profile(mock_db, mock_user)
    
    assert result.confidence == "high"
    assert "Analytical" in result.traits
    assert mock_user.ai_profile["user_profile"]["confidence"] == "high"
    mock_db.commit.assert_called_once()
