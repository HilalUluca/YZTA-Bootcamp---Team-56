import pytest
from unittest.mock import patch, MagicMock
from langchain_core.messages import HumanMessage, AIMessage

from app.services.memory_manager import get_conversation_context, update_summary_if_needed
from app.models.user import User
from app.models.chat import ChatMessageDB

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def mock_user():
    user = User(id="fake-uuid", ai_profile={"conversation_summary": "Test summary", "last_summarized_msg_count": 0})
    return user

@patch('app.services.memory_manager.get_settings')
@patch('app.services.memory_manager.get_recent_messages')
def test_get_conversation_context_summary_buffer(mock_get_recent, mock_settings, mock_db, mock_user):
    mock_settings.return_value.memory_strategy = "summary_buffer"
    mock_settings.return_value.recent_window_size = 4
    
    msg1 = ChatMessageDB(sender="human", message="Hello")
    msg2 = ChatMessageDB(sender="ai", message="Hi there")
    mock_get_recent.return_value = [msg1, msg2]
    
    summary, history = get_conversation_context(mock_db, mock_user)
    
    assert summary == "Test summary"
    assert len(history) == 2
    assert isinstance(history[0], HumanMessage)
    assert history[0].content == "Hello"
    assert isinstance(history[1], AIMessage)
    assert history[1].content == "Hi there"

@patch('app.services.memory_manager.get_settings')
@patch('app.services.memory_manager.get_recent_messages')
def test_get_conversation_context_last_n(mock_get_recent, mock_settings, mock_db, mock_user):
    mock_settings.return_value.memory_strategy = "last_n"
    
    summary, history = get_conversation_context(mock_db, mock_user)
    
    assert summary == "" # last_n shouldn't use summary
    
@patch('app.services.memory_manager.get_settings')
def test_update_summary_skipped_if_interval_not_met(mock_settings, mock_db):
    mock_settings.return_value.memory_strategy = "summary_buffer"
    mock_settings.return_value.summary_update_interval = 6
    
    mock_user = MagicMock()
    mock_user.ai_profile = {"last_summarized_msg_count": 2}
    
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user
    mock_db.query.return_value.filter.return_value.count.return_value = 5 # 5 - 2 = 3 < 6
    
    update_summary_if_needed(mock_db, "user-id")
    
    # ensure commit wasn't called
    mock_db.commit.assert_not_called()

@patch('app.services.memory_manager.ChatGoogleGenerativeAI')
@patch('app.services.memory_manager.get_settings')
def test_update_summary_triggers_llm(mock_settings, mock_chat, mock_db):
    mock_settings.return_value.memory_strategy = "summary_buffer"
    mock_settings.return_value.summary_update_interval = 6
    mock_settings.return_value.gemini_api_key = "dummy"
    
    mock_user = MagicMock()
    mock_user.ai_profile = {"last_summarized_msg_count": 0}
    
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user
    
    # the second query in update_summary_if_needed is for count()
    mock_db.query.return_value.filter.return_value.count.return_value = 7 # 7 - 0 >= 6 -> triggers
    
    # mock messages
    mock_msg = MagicMock()
    mock_msg.sender = "human"
    mock_msg.message = "Hello"
    mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [mock_msg]
    
    # mock LLM
    mock_llm_instance = MagicMock()
    mock_chat.return_value = mock_llm_instance
    
    # Mocking runnable invoke inside summary_prompt_template | llm
    mock_invoke_result = MagicMock()
    mock_invoke_result.content = "New generated summary"
    
    # We must patch RunnableSequence's invoke since it's a pipe
    with patch('langchain_core.runnables.RunnableSequence.invoke', return_value=mock_invoke_result):
        update_summary_if_needed(mock_db, "user-id")
    
    assert mock_user.ai_profile["conversation_summary"] == "New generated summary"
    assert mock_user.ai_profile["last_summarized_msg_count"] == 7
    mock_db.commit.assert_called_once()
