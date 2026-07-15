import json

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_db
from . import models, schemas

app = FastAPI(title=settings.app_name, version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)


@app.get("/api/health", response_model=schemas.HealthOut)
def health():
    return schemas.HealthOut(status="ok", app=settings.app_name)


@app.post("/api/trials", response_model=schemas.TrialOut)
def create_trial(payload: schemas.TrialCreate, db: Session = Depends(get_db)):
    code = payload.participant_code.strip() if payload.participant_code else None
    trial = models.Trial(
        participant_code=code or None,
        practice=payload.practice,
        pattern_id=payload.pattern_id,
        target_count=payload.target_count,
        intended_id=payload.intended_id,
        intended_label=payload.intended_label,
        chosen_id=payload.chosen_id,
        chosen_label=payload.chosen_label,
        correct=payload.correct,
        point_count=payload.point_count,
        elapsed_ms=payload.elapsed_ms,
        score=payload.score,
        stroke_json=json.dumps(payload.stroke),
        ranked_json=json.dumps([r.model_dump() for r in payload.ranked]),
        user_agent=payload.user_agent,
    )
    db.add(trial)
    db.commit()
    db.refresh(trial)
    return trial


@app.get("/api/trials", response_model=list[schemas.TrialOut])
def list_trials(db: Session = Depends(get_db)):
    return db.query(models.Trial).order_by(models.Trial.id.desc()).limit(500).all()
