# Motion Match

Phone web prototype: draw a path (optionally at a matching speed) to select among three moving targets.

**Stack:** Vite + vanilla JS · FastAPI · SQLite

## Run

First time: double-click `setup.bat`  
Then: double-click `start-dev.bat`

- App: http://localhost:5173/
- API: http://127.0.0.1:8000/docs

## Features

- Three targets with path + speed (Fast / Med / Slow)
- **Swap paths** — randomly change at least one trajectory
- **Speed: On/Off** — off = path shape only
- Results saved to `backend/data/motion_match.db` (`trials` table)
# MotionMatching
