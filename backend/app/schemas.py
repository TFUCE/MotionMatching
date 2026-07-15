from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RankedScore(BaseModel):
    id: str
    label: str
    score: float
    pathId: str | None = None
    speed: str | None = None
    shape: float | None = None
    speedScore: float | None = None


class TrialCreate(BaseModel):
    participant_code: str | None = None
    practice: bool = True
    pattern_id: str = "path_mimic"
    target_count: int = Field(ge=2, le=6)
    intended_id: str | None = None
    intended_label: str | None = None
    chosen_id: str
    chosen_label: str
    correct: bool = True
    point_count: int = Field(ge=0)
    elapsed_ms: int = Field(ge=0)
    score: float
    stroke: list[Any] = Field(default_factory=list)
    ranked: list[RankedScore] = Field(default_factory=list)
    user_agent: str | None = None


class TrialOut(BaseModel):
    id: int
    participant_code: str | None
    practice: bool
    pattern_id: str
    target_count: int
    intended_id: str | None
    intended_label: str | None
    chosen_id: str
    chosen_label: str
    correct: bool
    point_count: int
    elapsed_ms: int
    score: float
    created_at: datetime

    model_config = {"from_attributes": True}


class HealthOut(BaseModel):
    status: str
    app: str
