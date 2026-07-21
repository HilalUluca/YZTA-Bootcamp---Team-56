import pytest
from app.agents.reflection_agent import generate_coach_triggers

def test_generate_coach_triggers_critical():
    summary_data = {
        "current_week": {
            "mood_avg": 2.0,
            "energy_avg": 2.0,
            "negative_ratio": 0.6
        },
        "energy_diff": -1.5
    }
    triggers = generate_coach_triggers(summary_data)
    levels = [t["level"] for t in triggers]
    assert "critical" in levels
    assert "warning" in levels

def test_generate_coach_triggers_warning_only():
    summary_data = {
        "current_week": {
            "mood_avg": 3.0,
            "energy_avg": 3.0,
            "negative_ratio": 0.5
        },
        "energy_diff": -1.0
    }
    triggers = generate_coach_triggers(summary_data)
    levels = [t["level"] for t in triggers]
    assert "critical" not in levels
    assert "warning" in levels

def test_generate_coach_triggers_info():
    summary_data = {
        "current_week": {
            "mood_avg": 4.0,
            "energy_avg": 4.0,
            "negative_ratio": 0.1
        },
        "energy_diff": 0.5
    }
    triggers = generate_coach_triggers(summary_data)
    levels = [t["level"] for t in triggers]
    assert levels == ["info"]
