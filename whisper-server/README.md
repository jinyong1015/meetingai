# MeetingAI — Local Whisper (faster-whisper)

이 폴더는 **OpenAI API 없이** 로컬에서 Whisper 전사를 돌립니다.

선택 이유: Windows에서 `pip`만으로 설치 가능하고, Next.js의 기존  
`WHISPER_API_URL` → `POST /v1/audio/transcriptions` 연동과 바로 맞습니다.  
(`whisper.cpp`는 빌드·Windows 환경 구성이 더 무겁습니다.)

## 요구 사항

1. **Python 3.10+**
2. **ffmpeg** (브라우저 MediaRecorder `webm` 디코딩용)

```powershell
winget install Gyan.FFmpeg
```

설치 후 **터미널을 완전히 닫았다가** 다시 엽니다. `ffmpeg -version`이 되어야 합니다.

## 설치 · 실행 (Windows)

```powershell
cd whisper-server
.\start.ps1
```

첫 실행 시:

- `.venv` 생성
- `faster-whisper` 등 패키지 설치
- 모델 가중치 다운로드 (`.\models`, 기본 `small`)

서버 주소:

- Health: http://127.0.0.1:8080/health  
- 전사: `POST http://127.0.0.1:8080/v1/audio/transcriptions`

수동 실행:

```powershell
cd whisper-server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # 선택
python app.py
```

## Next.js 연동

프로젝트 루트 `.env.local`:

```env
STT_PROVIDER=whisper
WHISPER_API_URL=http://127.0.0.1:8080/v1/audio/transcriptions
WHISPER_MODEL=small
```

1. Whisper 서버를 먼저 띄운다 (`.\start.ps1`)
2. Next 앱을 재시작한다 (`npm run dev` — 직접 실행)
3. 앱 **설정**에서 STT = **Whisper** 저장
4. 녹음 종료 → AI 동의 → **AI 회의록 생성**

흐름: 브라우저 → Next `/api/stt/transcribe` → 로컬 `127.0.0.1:8080` (외부 OpenAI 호출 없음)

## 모델 크기

| 값 | 속도 | 품질(한국어) |
|---|---|---|
| `tiny` / `base` | 빠름 | 낮음~보통 |
| `small` (기본) | 적당 | 권장 |
| `medium` / `large-v3` | 느림 | 높음 |

`.env` 또는 환경변수 `WHISPER_MODEL=small` 로 변경합니다.  
GPU가 있으면 `WHISPER_DEVICE=cuda`, `WHISPER_COMPUTE_TYPE=float16` 을 사용할 수 있습니다.

## 문제 해결

| 증상 | 확인 |
|---|---|
| `ffmpeg가 PATH에 없습니다` | `winget install Gyan.FFmpeg` 후 터미널 재실행 |
| Next에서 연결 실패 | Whisper 서버가 8080에서 떠 있는지 `/health` 확인 |
| 설정에서 Whisper 저장 불가 | `.env.local`의 `WHISPER_API_URL` + Next 재시작 |
| 첫 기동이 김 | `small` 모델 다운로드 중 (한 번만) |
