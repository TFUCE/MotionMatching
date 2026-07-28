import json

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from sqlalchemy import inspect, text

from .config import settings
from .database import Base, engine, get_db
from . import models, schemas

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)
    if "tasks" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("tasks")}
    with engine.begin() as conn:
        if "speed_enabled" not in cols:
            conn.execute(
                text("ALTER TABLE tasks ADD COLUMN speed_enabled TINYINT(1) NOT NULL DEFAULT 1")
            )
        if "practice" in cols:
            conn.execute(text("ALTER TABLE tasks DROP COLUMN practice"))


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()


@app.get("/api/health", response_model=schemas.HealthOut)
def health():
    return schemas.HealthOut(status="ok", app=settings.app_name)


@app.post("/api/sessions", response_model=schemas.SessionOut)
def create_session(payload: schemas.SessionCreate, db: Session = Depends(get_db)):
    session = models.EvalSession(
        participant_code=payload.participant_code.strip(),
        testing_format=payload.testing_format,
        device_info=payload.device_info,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.patch("/api/sessions/{session_id}", response_model=schemas.SessionOut)
def end_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(models.EvalSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session.ended_at = models.utcnow()
    db.commit()
    db.refresh(session)
    return session


@app.post("/api/tasks", response_model=schemas.TaskOut)
def create_task(payload: schemas.TaskCreate, db: Session = Depends(get_db)):
    session = db.get(models.EvalSession, payload.session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    task = models.Task(
        session_id=payload.session_id,
        task_number=payload.task_number,
        speed_enabled=payload.speed_enabled,
        condition_id=payload.condition_id,
        path_id=payload.path_id,
        path_label=payload.path_label,
        path_characteristics=payload.path_characteristics,
        speed_label=payload.speed_label,
        speed_ms=payload.speed_ms,
        target_count=payload.target_count,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.patch("/api/tasks/{task_id}", response_model=schemas.TaskOut)
def complete_task(task_id: int, payload: schemas.TaskComplete, db: Session = Depends(get_db)):
    task = db.get(models.Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    task.completed = payload.completed
    task.success_attempt_index = payload.success_attempt_index
    task.total_attempts = payload.total_attempts
    task.error_count = payload.error_count
    task.completion_time_ms = payload.completion_time_ms
    db.commit()
    db.refresh(task)
    return task


@app.post("/api/attempts", response_model=schemas.AttemptOut)
def create_attempt(payload: schemas.AttemptCreate, db: Session = Depends(get_db)):
    task = db.get(models.Task, payload.task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    attempt = models.Attempt(
        task_id=payload.task_id,
        attempt_index=payload.attempt_index,
        success=payload.success,
        matched_target_id=payload.matched_target_id,
        matched_label=payload.matched_label,
        elapsed_ms=payload.elapsed_ms,
        score=payload.score,
        shape_score=payload.shape_score,
        speed_score=payload.speed_score,
        point_count=payload.point_count,
        stroke_json=json.dumps(payload.stroke) if payload.stroke else None,
        ranked_json=json.dumps([r.model_dump() for r in payload.ranked]) if payload.ranked else None,
        reason=payload.reason,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@app.post("/api/questionnaires", response_model=schemas.QuestionnaireOut)
def create_questionnaire(payload: schemas.QuestionnaireCreate, db: Session = Depends(get_db)):
    session = db.get(models.EvalSession, payload.session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    existing = (
        db.query(models.Questionnaire)
        .filter(models.Questionnaire.session_id == payload.session_id)
        .first()
    )
    if existing:
        raise HTTPException(400, "Questionnaire already submitted for this session")
    for key, value in payload.ratings.items():
        if value < 1 or value > 7:
            raise HTTPException(400, f"Rating out of range: {key}")
    row = models.Questionnaire(
        session_id=payload.session_id,
        language=payload.language,
        ratings_json=json.dumps(payload.ratings),
        open_json=json.dumps(payload.open_answers) if payload.open_answers else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
