from pathlib import Path

from pydantic_settings import BaseSettings

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_DB_PATH = _DATA_DIR / "motion_match.db"


class Settings(BaseSettings):
    app_name: str = "Motion Match API"
    database_url: str = f"sqlite:///{_DB_PATH.as_posix()}"
    data_dir: Path = _DATA_DIR
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


settings = Settings()
