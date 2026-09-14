#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
  echo "Python 3.10+ 이 필요합니다."
  exit 1
fi

PYTHON=python3
command -v python3 >/dev/null 2>&1 || PYTHON=python

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg가 PATH에 없습니다. webm 전사에 필요합니다."
  echo "macOS: brew install ffmpeg"
  echo "Ubuntu: sudo apt install ffmpeg"
  exit 1
fi

if [ ! -d .venv ]; then
  echo "Creating virtualenv (.venv)..."
  "$PYTHON" -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

python -m pip install --upgrade pip
pip install -r requirements.txt

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export WHISPER_MODEL="${WHISPER_MODEL:-small}"
export WHISPER_HOST="${WHISPER_HOST:-127.0.0.1}"
export WHISPER_PORT="${WHISPER_PORT:-8080}"

echo "Starting local Whisper on http://${WHISPER_HOST}:${WHISPER_PORT}"
echo "Model: ${WHISPER_MODEL}"
python app.py
