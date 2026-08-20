from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    participant_code: str = Field(min_length=1, max_length=64)
    testing_format: str = "online"
    device_info: str | None = None


class SessionOut(BaseModel):
    id: int
    participant_code: str
    testing_format: str
    started_at: datetime
    ended_at: datetime | None
    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    session_id: int
    task_number: int = Field(ge=1)
    practice: bool = False
    speed_enabled: bool = True
    condition_id: str
    path_id: str
    path_label: str
    path_characteristics: str | None = None
    speed_label: str
    speed_ms: int = Field(ge=100)
    target_count: int = Field(ge=2, le=6, default=3)


class TaskOut(BaseModel):
    id: int
    session_id: int
    task_number: int
    practice: bool
    speed_enabled: bool
    condition_id: str
    path_id: str
    path_label: str
    path_characteristics: str | None
    speed_label: str
    speed_ms: int
    target_count: int
    completed: bool
    success_attempt_index: int | None
    total_attempts: int
    error_count: int
    completion_time_ms: int | None
    created_at: datetime
    model_config = {"from_attributes": True}


class RankedScore(BaseModel):
    id: str
    label: str
    score: float
    pathId: str | None = None
    speed: str | None = None
    shape: float | None = None
    speedScore: float | None = None


class AttemptCreate(BaseModel):
    task_id: int
    attempt_index: int = Field(ge=1)
    success: bool = False
    matched_target_id: str | None = None
    matched_label: str | None = None
    elapsed_ms: int = Field(ge=0)
    score: float = 0.0
    shape_score: float = 0.0
    speed_score: float = 0.0
    point_count: int = Field(ge=0, default=0)
    stroke: list[Any] = Field(default_factory=list)
    ranked: list[RankedScore] = Field(default_factory=list)
    reason: str | None = None
    pointer_type: str | None = None


class AttemptOut(BaseModel):
    id: int
    task_id: int
    attempt_index: int
    success: bool
    matched_target_id: str | None
    matched_label: str | None
    elapsed_ms: int
    score: float
    shape_score: float
    speed_score: float
    point_count: int
    reason: str | None
    pointer_type: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class TaskComplete(BaseModel):
    completed: bool = True
    success_attempt_index: int | None = None
    total_attempts: int = Field(ge=0)
    error_count: int = Field(ge=0)
    completion_time_ms: int | None = None


class HealthOut(BaseModel):
    status: str
    app: str


class QuestionnaireCreate(BaseModel):
    session_id: int
    language: str = "en"
    ratings: dict[str, int]
    open_answers: dict[str, str] = Field(default_factory=dict)


class QuestionnaireOut(BaseModel):
    id: int
    session_id: int
    language: str
    created_at: datetime
    model_config = {"from_attributes": True}
