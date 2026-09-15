# AI 회의노트

회의 음성을 녹음하고, 메모와 함께 AI 회의록을 만드는 웹 앱입니다.  
기준 문서: [`docs/prd.md`](docs/prd.md) (v0.3.6), [`docs/화면설계서.md`](docs/화면설계서.md) (v0.9)

---

## AI 엔진 구조

STT와 LLM을 각각 로컬·클라우드 중 선택해 사용합니다.

```text
MeetingAI (Vercel 또는 localhost)
├── STT (음성 → 텍스트)
│   ├── Whisper      … 브라우저 → 사용자 PC의 faster-whisper (:8080)
│   └── AssemblyAI   … 브라우저 → Vercel API → AssemblyAI (키는 서버만)
└── LLM (요약 · 상세 회의록)
    ├── Ollama       … 브라우저 → 사용자 PC의 Ollama (:11434)
    └── OpenAI       … 브라우저 → Vercel API → OpenAI (키는 서버만)
```

| 구분 | 옵션 | 처리 위치 | 현재 |
|---|---|---|---|
| **STT** | Whisper / AssemblyAI | **브라우저→로컬** / 서버→클라우드 | **구현** |
| **LLM** | Ollama / OpenAI | **브라우저→로컬** / 서버→클라우드 | **구현** |

설정(SCR-05)에서 STT·LLM·로컬 URL·모델을 고를 수 있습니다. 기본값은 **Whisper(로컬)** + **Ollama(로컬)** 입니다.

> Vercel에 배포해도 로컬 Whisper/Ollama는 **사용자 PC에서 실행**해야 하며, 앱이 브라우저에서 `127.0.0.1`로 직접 호출합니다. Vercel 서버가 localhost를 호출하지 않습니다.

---

## 데이터가 어디에 저장되나

| 데이터 | 위치 | 설명 |
|---|---|---|
| 회의·메모·음성·전사·AI 결과·설정 | **브라우저 IndexedDB** (`meetingai`) | 프로젝트 폴더 파일이 아님. 동일 Chrome·`localhost:3000`에서만 유지 |
| Whisper 모델 가중치 | `whisper-server/models/` | PC 디스크. 회의 본문은 여기에 안 남음 |
| 전사 중 임시 오디오 | OS 임시 폴더 | Whisper 처리 후 삭제 |
| 비밀키 | `.env.local` / Vercel Env (서버 전용) | OpenAI·AssemblyAI 키. 브라우저에 노출하지 않음 |
| 로컬 엔진 URL·모델 | IndexedDB 설정 (+ env 시드) | Whisper/Ollama 주소는 사용자 PC 기준 |

DevTools → Application → IndexedDB → `meetingai` 에서 `meetings` / `notes` / `audioChunks` / `meetingAudio` / `transcripts` / `generations` / `settings` 를 확인할 수 있습니다.

---

## 전체 진행률

| 구분 | 진행률 | 설명 |
|---|---:|---|
| **P0 MVP (출시 필수)** | **약 90%** | SCR-01~05 완료(SCR-04 전용 Route·확정·근거·이력 포함). SCR-06 미착수 |
| P1 (후속) | 0% | 미착수 |
| P2 / Future | 0% | 미착수 (실시간 전사 포함) |

> 진행률은 화면설계서 **P0 필수 항목**을 기준으로 산정했습니다.

---

## 진행 목차 (P0)

### 1. 기반 작업 — 완료
- [x] Next.js 프로젝트 구성
- [x] PRD / 화면설계서 문서
- [x] 공통 UI 톤 (글래스·틸 액센트)
- [x] IndexedDB 공통 레이어 (`meetings` · `notes` · `settings` · `transcripts` · `generations` · `audioChunks` · `meetingAudio`)

### 2. SCR-01 회의 목록 — 완료
- [x] `/` · `/meetings` 목록 화면 (마케팅 랜딩 없음)
- [x] 헤더 (제품명 · 로컬 저장됨 · 설정)
- [x] 회의 카드 (제목 · 일시 · 길이 · 상태 · 요약 미리보기)
- [x] 검색 (제목·태그·참석자·요약·메모·전사문·AI 본문, 300ms debounce)
- [x] 기간 · 상태 · 확정 · 정렬 필터
- [x] 빈 화면 / 검색 결과 없음 구분 · 필터 초기화
- [x] 더보기 · 삭제 확인 · 회의 JSON 내보내기 (메모·전사·생성 포함)
- [x] 저장 공간 표시 · 백업 관리 (회의+메모 JSON)
- [x] 삭제 시 메모·전사·생성·음성 데이터 cascade 정리

### 3. SCR-02 새 회의 / 녹음 — 완료
- [x] 새 회의 생성 폼 (`/meetings/new`) — 제목·일시·참석자·태그
- [x] **`[회의 시작]` 시에만 IndexedDB 저장**
- [x] 생성 후 `/meetings/{meetingId}/record` 이동
- [x] 녹음 제어 (시작 · 일시정지 · 재개 · 종료)
- [x] 경과 시간 타이머 (일시정지 제외)
- [x] `getUserMedia` 마이크 권한 · 권한 안내 UX
- [x] 마이크 장치 선택 · 입력 확인 웨이브
- [x] `MediaRecorder` 음성 수집 (`audio/webm;codecs=opus` 우선)
- [x] 입력 레벨 웨이브 — **실제 음성 감지 시에만 반응** (`useMicAnalyser`)
- [x] 녹음 종료 확인 모달
- [x] 음성 조각 로컬 저장 · 복구 (REC-04, 약 5초)
- [x] 원본 재생 · 다운로드 (REC-06)
- [x] AI 처리 · 엔진별 전송 동의 UX (`[음성만 저장]` / `[AI 회의록 생성]`)
- [x] 동의 후 STT 전사 (Whisper 또는 AssemblyAI)
- [x] 동의 후 **LLM** 요약·상세 생성 (Ollama 또는 OpenAI)
- [x] 회의 결과 탭 (**전사문 · 요약 · 상세**, 기본 탭=전사문)
- [x] 가상 데이터로 요약·상세 미리보기
- [x] 전사문 · 생성 결과 IndexedDB 저장 · 새로고침 복원
- [x] SCR-03 처리 단계 UI (경과 시간 · 엔진 · 단계별 재시도)

### 4. 메모 입력 (NOTE-01~05) — 완료
- [x] 메모 추가 · 수정 · 삭제
- [x] 회의당 20,000자 제한
- [x] 녹음 중 시점 표시
- [x] 중요 · AI 반영 토글
- [x] 자동 저장 (1초 / 최대 5초)
- [x] 저장 상태 표시
- [x] IndexedDB 로컬 저장 · 새로고침 복원
- [x] 시점 클릭 시 실제 음성 위치 이동 (원본 플레이어 연동)

### 5. STT (녹음 종료 · 동의 후) — 완료
- [x] STT 어댑터 인터페이스 (`assemblyai` · `whisper`)
- [x] AssemblyAI **Pre-recorded** (`universal-2`, `language_code: ko`, `speaker_labels`)
- [x] **로컬 faster-whisper 서버** (`whisper-server`, OpenAI 호환 `/v1/audio/transcriptions` · 구간 시각)
- [x] Whisper 어댑터 (`WHISPER_API_URL` → localhost:8080)
- [x] `POST /api/stt/transcribe` · `GET /api/stt/status` · `POST/GET /api/stt/jobs`
- [x] 설정에서 STT 엔진 선택 · Whisper `/health` 프로브
- [x] 화자 구분 · 구간별 시점 (AI-03) — AssemblyAI 화자 라벨 · Whisper 시점 구간 · 화자명 수정
- [x] SCR-03 처리 단계 UI · 재조회(AI-05) — AssemblyAI `remoteJobId` 폴링

### 6. SCR-03 AI 처리 (LLM) — 완료
- [x] LLM 어댑터 (Ollama · OpenAI)
- [x] 실제 LLM 요약 · 상세 생성 API (`POST /api/generations`)
- [x] AI 동의 UX (엔진별 로컬/클라우드 전송 안내)
- [x] 가상 데이터로 요약·상세 결과 미리보기
- [x] 처리 단계 · 경과 시간 · 사용 엔진 UI (`AiProcessingPanel`, 녹음 화면에 임베드)
- [x] 요약/상세 개별 재생성 (AI-08)

### 7. SCR-04 회의 결과 / 검토 — 약 90%
- [x] 전사문 · 요약 · 상세 탭 조회
- [x] 요약: 회의 내용 요약 텍스트만 표시
- [x] 상세: 문서형 회의록 · 사용자 수정 · 저장
- [x] 원본 음성 재생 · 다운로드
- [x] 전용 Route `/meetings/{meetingId}` 분리
- [x] 확정 · 버전 관리 · 근거 재생
- [x] 이력 탭 (보기 · 복원)
- [ ] 외부 연동 탭 본편 (SCR-06 · 현재 플레이스홀더)

### 8. SCR-05 설정 — 완료
- [x] 헤더·녹음 화면 설정 대화상자
- [x] AI 엔진 탭: **STT** (Whisper · AssemblyAI) · **LLM** (Ollama · OpenAI)
- [x] 엔진 연결 상태 (키 미노출 · Ollama 연결 프로브 · Whisper health)
- [x] 일반 설정 (시간대 · 녹음 후 AI 안내 · 기본 테마)
- [x] AI 프롬프트 관리 (요약/상세 · 20~4000자 · 버전 · 기본값 복원 · 샘플 시험)
- [x] 저장·백업 탭 · 데이터 처리 안내
- [x] 미저장 변경 닫기 확인
- [x] 목록 하단 백업·복원
- [ ] 외부 연동 탭 본편 (SCR-06과 함께)

### 9. SCR-06 외부 연동 — 0%
- [ ] 웹훅 수신처 설정
- [ ] 확정본 전송 · 이력

---

## 현재까지 만든 것 (요약)

| 경로 | 내용 |
|---|---|
| `/`, `/meetings` | SCR-01 회의 목록 · 검색(전사·AI 포함) · 필터 · cascade 삭제 · 백업 |
| `/meetings/new` | SCR-02 Step 1 새 회의 생성 (설정 시간대 반영) |
| `/meetings/[meetingId]` | **SCR-04** 검토 · 확정 · 근거 · 이력 |
| `/meetings/[meetingId]/record` | 녹음 · 메모 · 조각 저장 · 원본 재생 · AI 동의 · STT · **SCR-03 처리 패널** |
| `app/api/stt/*` | 전사 · 엔진 상태 · AssemblyAI 비동기 jobs |
| `app/api/generations` | Ollama/OpenAI 요약·상세 (사용자 프롬프트 전달) |
| `app/api/llm/status` | LLM 엔진 연결 상태 |
| `whisper-server/` | 로컬 faster-whisper (구간 `segments` 포함) |
| `components/recording/*` | RecordMeetingScreen · AiProcessingPanel · AudioPlayer · AiConsentDialog |
| `components/review/*` | MeetingResultTabs · SummaryPanel · DetailPanel |
| `components/settings/*` | SettingsDialog (일반 · 엔진 · 프롬프트 · 백업 · 안내) |
| `lib/hooks/useMicAnalyser` | 장치 선택 · AnalyserNode · `voiceActive` |
| `lib/stt/*` | AssemblyAI · Whisper 어댑터 · 구간 매핑 |
| `lib/llm/*` | Ollama · OpenAI 어댑터 · 프롬프트 · Structured Outputs |
| `lib/storage/*` | IndexedDB 전체 스토어 (설정·프롬프트 버전 포함) |

**아직 없음:** SCR-06 웹훅 본편, 실시간(Realtime) 전사

### 저장 시점 (중요)

| 동작 | 목록·DB에 남는가 |
|---|---|
| `/meetings/new` 열기만 하고 취소·목록으로 복귀 | 아니오 |
| `[회의 시작]` 클릭 | 예 (`meetings`) |
| 녹음 중 | 예 (`audioChunks` · 약 5초) |
| 녹음 종료 후 `[음성만 저장]` / AI 안내 off | 예 (`meetingAudio` · STT 없음) |
| 녹음 종료 후 `[AI 회의록 생성]` · STT 완료 | 예 (`transcripts`) |
| OpenAI/Ollama 요약·상세 완료 / 가상 미리보기 / 상세 수정 저장 | 예 (`generations` · `summaryPreview`) |
| 설정 저장 | 예 (`settings`) |

---

## 로컬 실행

### 1) 로컬 Whisper 서버 (기본 STT)

OpenAI API 없이 **faster-whisper**가 `localhost:8080`에서  
`POST /v1/audio/transcriptions` 를 제공합니다. 상세: [`whisper-server/README.md`](whisper-server/README.md)

```powershell
# ffmpeg (webm 디코딩) — 권장, 한 번만
winget install Gyan.FFmpeg
# 터미널을 닫았다가 다시 연 뒤:

cd whisper-server
.\start.ps1
```

Health 확인: http://127.0.0.1:8080/health

### 2) Next.js 앱

```bash
npm install
cp .env.example .env.local   # whisper · ollama 기본값 포함
npm run dev
```

### 3) 로컬 Ollama (기본 LLM)

[Ollama](https://ollama.com) 설치 후 모델을 받아 두세요.

```powershell
# 로컬 개발 Origin 허용 (필수: 브라우저 직접 호출)
$env:OLLAMA_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
ollama serve
ollama pull qwen3:8b
```

브라우저에서 `http://localhost:3000` 접속 → **설정 → AI 엔진**에서  
STT = Whisper, LLM = Ollama, URL 확인 → **로컬 엔진 연결 테스트** → 저장

### 환경변수 (`.env.local` / Vercel)

| 변수 | 설명 |
|---|---|
| `STT_PROVIDER` | `whisper` (기본) 또는 `assemblyai` |
| `WHISPER_API_URL` | 브라우저 설정 시드 · `http://127.0.0.1:8080/v1/audio/transcriptions` |
| `WHISPER_MODEL` | 로컬 모델 크기 (`small` 권장) |
| `ASSEMBLYAI_API_KEY` | **서버 전용** · AssemblyAI 사용 시 |
| `LLM_PROVIDER` | `ollama` (기본) 또는 `openai` — 설정 UI 선택값이 우선 |
| `OPENAI_API_KEY` | **서버 전용** · OpenAI 사용 시 |
| `OPENAI_MODEL` | 기본 `gpt-4.1-mini-2025-04-14` |
| `OLLAMA_BASE_URL` | 브라우저 시드 · `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | 예: `qwen3:8b` |
| `MAKE_WEBHOOK_URL` | Make 웹훅 (선택) |

> API 키에 `NEXT_PUBLIC_`를 붙이지 마세요.  
> 로컬 URL/모델은 비밀이 아니며 `/api/local-engines/defaults`로 시드됩니다.

### Vercel 배포 후 로컬 엔진 연결

1. Vercel Environment Variables에 **클라우드 키만** 넣습니다: `ASSEMBLYAI_API_KEY`, `OPENAI_API_KEY` (및 선택적 URL 시드).
2. 사용자 PC에서 Whisper 서버를 켭니다 (`WHISPER_CORS_ORIGINS=*` 또는 배포 Origin).
3. 사용자 PC에서 Ollama를 켭니다:
   ```powershell
   $env:OLLAMA_ORIGINS="https://your-app.vercel.app"
   ollama serve
   ```
4. 배포된 사이트 → **설정 → AI 엔진**에서 Whisper/Ollama URL 확인 → **연결 테스트** → 저장.
5. Chrome/Edge는 보통 `https` → `http://127.0.0.1` 루프백을 허용합니다. Safari 등에서 막히면 로컬 엔진을 mkcert HTTPS로 띄우세요.

가능한 조합: AssemblyAI+OpenAI, AssemblyAI+Ollama, Whisper+OpenAI, Whisper+Ollama.

---

## 다음에 할 일 (권장 순서)

1. **SCR-06** 웹훅 (수신처 · 확정본 전송 · 이력)
2. 전사 원문/수정본 분리(AI-04) 고도화 · 근거 필드 LLM 연동(AI-07)

---

## 문서

| 문서 | 설명 |
|---|---|
| [docs/prd.md](docs/prd.md) | 제품 요구사항 (v0.3.6) |
| [docs/화면설계서.md](docs/화면설계서.md) | 화면별 UI/UX · AC · 구현 현황 (v0.9) |
| [whisper-server/README.md](whisper-server/README.md) | 로컬 Whisper 설치·실행 |
