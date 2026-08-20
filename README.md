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

Use participant codes **P01–P13**. Each person completes practice, then Part 1 (path only) and Part 2 (path + speed).

| Phase | Mode | Per participant |
|-------|------|-----------------|
| Practice | Path only (not scored) | 2 |
| Part 1 | Path only | 3 |
| Part 2 | Same 3 paths × 3 speeds | 9 |
| Questionnaire | Likert + open questions | 1 |
| **Formal tasks** | | **12** |

Part 2 crosses each path with Fast, Med, and Slow so path and speed can be analyzed independently.

## Data model

| Table | Purpose |
|-------|---------|
| `sessions` | One participant session |
| `tasks` | Assigned task (`speed_enabled`, path, speed, errors, time) |
| `attempts` | Every draw attempt (success and failure) |
| `questionnaires` | Post-study ratings + open answers |
