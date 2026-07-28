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

Use participant codes **P01–P13**. Each person gets a balanced subset so that, across 13 participants, all paths and speeds are covered.

| Phase | Mode | Per participant |
|-------|------|-----------------|
| Part 1 | Path only (3 paths) | 3 |
| Part 2 | **Same 3 paths** + speed | 3 |
| Questionnaire | Likert + open questions | 1 |
| **Total tasks** | | **6** |

Home screen: language (EN/中文) and theme (dark/light).

Part 1 and Part 2 use the same paths for each participant so speed effects can be compared within-subject. Across P01–P13, path and speed assignments rotate for coverage.

## Data model

| Table | Purpose |
|-------|---------|
| `sessions` | One participant session |
| `tasks` | Assigned task (`speed_enabled`, path, speed, errors, time) |
| `attempts` | Every draw attempt (success and failure) |
| `questionnaires` | Post-study ratings + open answers |
