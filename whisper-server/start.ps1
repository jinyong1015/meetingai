# Local Whisper server for MeetingAI (Windows PowerShell)
# Usage: .\start.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "python")) {
  Write-Error "Python이 없습니다. Python 3.10+ 설치 후 다시 실행하세요."
}

if (-not (Test-Command "ffmpeg")) {
  Write-Host ""
  Write-Host "경고: ffmpeg가 PATH에 없습니다. PyAV로 디코딩을 시도합니다." -ForegroundColor Yellow
  Write-Host "webm 전사가 실패하면: winget install Gyan.FFmpeg 후 터미널을 다시 여세요."
  Write-Host ""
}

if (-not (Test-Path ".venv")) {
  Write-Host "Creating virtualenv (.venv)..."
  python -m venv .venv
}

$activate = Join-Path $PSScriptRoot ".venv\Scripts\Activate.ps1"
. $activate

Write-Host "Installing / updating Python packages..."
python -m pip install --upgrade pip
pip install -r requirements.txt

if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $name, $value = $_.Split("=", 2)
    if ($name -and $value -ne $null) {
      Set-Item -Path "Env:$($name.Trim())" -Value $value.Trim()
    }
  }
}

$model = if ($env:WHISPER_MODEL) { $env:WHISPER_MODEL } else { "small" }
$hostName = if ($env:WHISPER_HOST) { $env:WHISPER_HOST } else { "127.0.0.1" }
$port = if ($env:WHISPER_PORT) { $env:WHISPER_PORT } else { "8080" }

Write-Host ""
Write-Host "Starting local Whisper on http://${hostName}:${port}" -ForegroundColor Cyan
Write-Host "Model: $model  (first run downloads weights into .\models)"
Write-Host "Health: http://${hostName}:${port}/health"
Write-Host "OpenAI-compatible: POST /v1/audio/transcriptions"
Write-Host ""

python app.py
