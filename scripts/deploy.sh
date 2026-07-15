#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/MotionMatching}"
# 公网 IP 变了就改这个，或在 GitHub Secrets 里设 VITE_API_BASE
API_BASE="${VITE_API_BASE:-http://16.171.250.66:8000/api}"

cd "$APP_DIR"

echo "==> Pull latest code"
git fetch origin main
git reset --hard origin/main

echo "==> Clean install frontend deps (never reuse committed node_modules)"
rm -rf node_modules
npm install

echo "==> Install backend deps"
cd "$APP_DIR/backend"
if [[ ! -d .venv ]]; then
  python3.11 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -r requirements.txt

echo "==> Restart API on :8000"
pkill -f "uvicorn app.main:app" || true
sleep 1
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$HOME/api.log" 2>&1 &

echo "==> Build frontend"
cd "$APP_DIR"
VITE_API_BASE="$API_BASE" npm run build

echo "==> Restart web on :4173"
pkill -f "serve -s dist" || true
sleep 1
nohup npx --yes serve -s dist -l 4173 > "$HOME/web.log" 2>&1 &

echo "==> Done"
curl -s "http://127.0.0.1:8000/api/health" || true
echo
