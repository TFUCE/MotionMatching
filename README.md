# Motion Match

Evaluation prototype for touchscreen motion-matching.

**Stack:** Vite + vanilla JS · FastAPI · MySQL

## Setup

1. Configure MySQL (one-time):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\setup-mysql.ps1 -Password "YOUR_MYSQL_PASSWORD"
   ```
2. First time: double-click `setup.bat`
3. Then: double-click `start-dev.bat`

- App: http://localhost:5173/
- API: http://127.0.0.1:8000/docs

## Evaluation design

Use participant codes **P01–P13**. Every participant completes all 6 path conditions.

| Phase | Mode | Per participant |
|-------|------|-----------------|
| Practice | Path only, Medium (not scored) | 2 |
| Part 1 | All 6 paths, path only, Medium | 6 |
| Part 2 | All 6 paths × Fast / Med / Slow | 18 |
| Questionnaire | Likert + open questions | 1 |
| **Formal tasks** | | **24** |

Part 1 keeps display speed at Medium so path shape is not confounded with speed. Part 2 fully crosses path and speed, interleaved so the same path is never shown three times in a row. Task order rotates by participant code. A task fails after 5 unsuccessful attempts.

## Data model

| Table | Purpose |
|-------|---------|
| `sessions` | One participant session |
| `tasks` | Assigned task (`speed_enabled`, path, speed, errors, time) |
| `attempts` | Every draw attempt (success and failure) |
| `questionnaires` | Post-study ratings + open answers |
