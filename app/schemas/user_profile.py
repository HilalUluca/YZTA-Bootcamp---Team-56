from pydantic import BaseModel
from datetime import datetime
from enum import Enum

class TraitGroup(str, Enum):
    IDENTITY = "identity"
    WORK_RHYTHM = "work_rhythm"
    STRESS_PROFILE = "stress_profile"
    COMM_STYLE = "comm_style"
    GOAL_ORIENTATION = "goal_orientation"

class Trait(BaseModel):
    group: TraitGroup
    value: str              # "hayvansever"
    confidence: float       # 0.0-1.0, düşükse prompt'a girmesin
    last_confirmed: datetime  # ne zaman güncellendi/doğrulandı

class UserProfile(BaseModel):
    user_id: str
    traits: list[Trait]
    version: int = 1