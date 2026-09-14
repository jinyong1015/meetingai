"""
Local Whisper STT server (faster-whisper).

OpenAI-compatible:
  POST /v1/audio/transcriptions
  GET  /health
"""

from __future__ import annotations

import os
import shutil
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel

HOST = os.getenv("WHISPER_HOST", "127.0.0.1")
PORT = int(os.getenv("WHISPER_PORT", "8080"))
MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
DOWNLOAD_ROOT = os.getenv(
    "WHISPER_DOWNLOAD_ROOT",
    str(Path(__file__).resolve().parent / "models"),
)

_model: WhisperModel | None = None


def _require_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        print(
            "[whisper-server] 경고: 시스템 ffmpeg가 PATH에 없습니다. "
            "PyAV로 디코딩을 시도합니다. webm 실패 시 "
            "`winget install Gyan.FFmpeg` 후 터미널을 다시 여세요."
        )


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        raise HTTPException(status_code=503, detail="모델이 아직 로드되지 않았습니다.")
    return _model


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _model
    _require_ffmpeg()
    Path(DOWNLOAD_ROOT).mkdir(parents=True, exist_ok=True)
    print(
        f"[whisper-server] loading model={MODEL_SIZE} device={DEVICE} "
        f"compute_type={COMPUTE_TYPE}"
    )
    _model = WhisperModel(
        MODEL_SIZE,
        device=DEVICE,
        compute_type=COMPUTE_TYPE,
        download_root=DOWNLOAD_ROOT,
    )
    print("[whisper-server] ready")
    yield
    _model = None


app = FastAPI(title="MeetingAI Local Whisper", lifespan=lifespan)


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
    }


@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": MODEL_SIZE,
                "object": "model",
                "owned_by": "faster-whisper",
            }
        ],
    }


def _suffix_for_upload(filename: str | None, content_type: str | None) -> str:
    name = (filename or "").lower()
    for ext in (".webm", ".wav", ".mp3", ".mp4", ".m4a", ".ogg", ".mpeg", ".mpga"):
        if name.endswith(ext):
            return ext
    ct = (content_type or "").lower()
    if "webm" in ct:
        return ".webm"
    if "wav" in ct:
        return ".wav"
    if "mpeg" in ct or "mp3" in ct:
        return ".mp3"
    if "mp4" in ct or "m4a" in ct:
        return ".mp4"
    if "ogg" in ct:
        return ".ogg"
    return ".webm"


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: Annotated[UploadFile, File()],
    model: Annotated[str | None, Form()] = None,
    language: Annotated[str | None, Form()] = None,
    response_format: Annotated[str | None, Form()] = None,
):
    del model  # local server always uses the loaded model
    if response_format and response_format not in ("json", "text", ""):
        raise HTTPException(
            status_code=400,
            detail="response_format은 json 또는 text만 지원합니다.",
        )

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="빈 오디오 파일입니다.")

    suffix = _suffix_for_upload(file.filename, file.content_type)
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(payload)
            tmp_path = tmp.name

        whisper = get_model()
        lang = (language or "ko").strip() or "ko"
        segments, _info = whisper.transcribe(
            tmp_path,
            language=lang,
            vad_filter=True,
            beam_size=1,
        )
        text = "".join(segment.text for segment in segments).strip()

        if response_format == "text":
            return JSONResponse(content=text, media_type="text/plain")
        return {"text": text}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"전사 실패: {exc}",
        ) from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host=HOST,
        port=PORT,
        reload=False,
    )
