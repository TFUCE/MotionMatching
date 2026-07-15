from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Trial(Base):
    """One row = one path-mimic attempt."""

    __tablename__ = "trials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    practice: Mapped[bool] = mapped_column(Boolean, default=False)
    pattern_id: Mapped[str] = mapped_column(String(32), default="path_mimic")
    target_count: Mapped[int] = mapped_column(Integer)
    intended_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    intended_label: Mapped[str | None] = mapped_column(String(8), nullable=True)
    chosen_id: Mapped[str] = mapped_column(String(32))
    chosen_label: Mapped[str] = mapped_column(String(8))
    correct: Mapped[bool] = mapped_column(Boolean)
    point_count: Mapped[int] = mapped_column(Integer)
    elapsed_ms: Mapped[int] = mapped_column(Integer)
    score: Mapped[float] = mapped_column(Float)
    stroke_json: Mapped[str] = mapped_column(Text)
    ranked_json: Mapped[str] = mapped_column(Text)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
