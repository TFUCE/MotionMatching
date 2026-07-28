from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class EvalSession(Base):
    """One participant's complete evaluation session."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_code: Mapped[str] = mapped_column(String(64), index=True)
    testing_format: Mapped[str] = mapped_column(String(16), default="online")
    device_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tasks: Mapped[list["Task"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    questionnaire: Mapped["Questionnaire | None"] = relationship(
        back_populates="session", uselist=False, cascade="all, delete-orphan"
    )


class Questionnaire(Base):
    """Post-study questionnaire for one session."""

    __tablename__ = "questionnaires"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("sessions.id"), unique=True, index=True)
    language: Mapped[str] = mapped_column(String(8), default="en")
    ratings_json: Mapped[str] = mapped_column(Text)
    open_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped["EvalSession"] = relationship(back_populates="questionnaire")


class Task(Base):
    """One assigned evaluation task within a session."""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("sessions.id"), index=True)
    task_number: Mapped[int] = mapped_column(Integer)
    speed_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    condition_id: Mapped[str] = mapped_column(String(64))
    path_id: Mapped[str] = mapped_column(String(32))
    path_label: Mapped[str] = mapped_column(String(16))
    path_characteristics: Mapped[str | None] = mapped_column(String(128), nullable=True)
    speed_label: Mapped[str] = mapped_column(String(16))
    speed_ms: Mapped[int] = mapped_column(Integer)
    target_count: Mapped[int] = mapped_column(Integer, default=3)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    success_attempt_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_attempts: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    completion_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped["EvalSession"] = relationship(back_populates="tasks")
    attempts: Mapped[list["Attempt"]] = relationship(back_populates="task", cascade="all, delete-orphan")


class Attempt(Base):
    """One drawing attempt for a task (both successes and failures are recorded)."""

    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id"), index=True)
    attempt_index: Mapped[int] = mapped_column(Integer)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    matched_target_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    matched_label: Mapped[str | None] = mapped_column(String(8), nullable=True)
    elapsed_ms: Mapped[int] = mapped_column(Integer)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    shape_score: Mapped[float] = mapped_column(Float, default=0.0)
    speed_score: Mapped[float] = mapped_column(Float, default=0.0)
    point_count: Mapped[int] = mapped_column(Integer, default=0)
    stroke_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    ranked_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    task: Mapped["Task"] = relationship(back_populates="attempts")
