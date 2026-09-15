# AI 회의노트

회의 음성을 녹음하고, 메모와 함께 AI 회의록을 만들고 검토·확정·외부 전송하는 PC 웹 앱입니다.

기준 문서: [`docs/prd.md`](docs/prd.md) (v0.3.7), [`docs/화면설계서.md`](docs/화면설계서.md) (v0.10)

**기본 흐름:** 녹음 → 종료 후 전사 → 요약·상세 생성 → 검토·확정 → (선택) 웹훅 전송

---

## 화면 구성

마케팅 랜딩은 두지 않으며, `/`와 `/meetings`는 동일한 회의 목록입니다. 설정은 별도 Route가 아니라 헤더의 **설정** Dialog로 엽니다.

| 화면 ID | 화면명 | Route | 역할 |
|---|---|---|---|
| SCR-01 | 회의 목록 | `/`, `/meetings` | 검색·필터·삭제·내보내기, 새 회의 시작 |
| SCR-02 Step 1 | 새 회의 생성 | `/meetings/new` | 제목·일시·참석자·태그 입력. `[회의 시작]` 시에만 저장 |
| SCR-02 Step 2 | 녹음·메모 | `/meetings/{id}/record` | 마이크 녹음, 시점 메모, 원본 재생·다운로드 |
| SCR-03 | AI 처리 | *(녹음 화면에 임베드)* | 전사·요약·상세 단계·경과·엔진·실패 재시도 |
| SCR-04 | 회의 결과 / 검토 | `/meetings/{id}` | 전사문·요약·상세·이력·외부 연동, 확정·근거 재생 |
| SCR-05 | 설정 | Header → 설정 | 일반 · AI 엔진 · 프롬프트 · 외부 연동 · 저장·백업 · 안내 |
| SCR-06 | 외부 연동 | SCR-04 탭 / SCR-05 탭 | 확정본 웹훅 전송·이력·재시도 |

### 메뉴·탭

**헤더 (공통)**  
서비스명 · 현재 화면/회의 제목 · 저장 상태 · 설정

**회의 목록 (SCR-01)**  
`+ 새 회의` · 검색 · 기간/상태/확정 필터 · 정렬 · 카드 More(내보내기·삭제) · 저장 공간·백업

**회의 결과 탭 (SCR-04)** — 기본 탭: **전사문**

```text
[전사문] [요약] [상세] [이력] [외부 연동]
```

**설정 탭 (SCR-05)**

```text
[일반] [AI 엔진] [AI 프롬프트] [외부 연동] [저장·백업] [데이터 처리 안내]
```

---

## 사용자 흐름

```text
SCR-01 회의 목록
        │ 새 회의
        ▼
SCR-02 새 회의 / 녹음
        │ 녹음 종료
        ▼
AI 처리 여부 확인
   │             │
음성만 저장      AI 생성
   │             ▼
   │       SCR-03 AI 처리 (녹음 화면 패널)
   │             │
   └──────── SCR-04 결과 / 검토
                     │ 확정
                     ▼
              SCR-06 외부 연동 (웹훅 ON 시)
```

설정(SCR-05)은 목록·녹음·검토 화면 헤더에서 언제든 접근합니다.

---

## 주요 기능

### 회의 목록 (SCR-01)
- 회의 카드: 제목 · 일시 · 길이 · 상태 배지 · 요약 미리보기
- 검색: 제목·태그·참석자·메모·전사문·AI 요약/상세 (300ms debounce)
- 기간·상태·확정 필터와 최신순/오래된순 정렬을 동시에 적용
- 삭제 시 메모·음성·전사·AI 결과·버전 cascade 정리
- 회의 JSON 내보내기 · 브라우저 저장 공간 표시 · 백업/복원

### 새 회의 · 녹음 (SCR-02)
- `[회의 시작]` 전에 취소·목록 복귀 시 회의를 만들지 않음
- MediaRecorder 녹음(시작·일시정지·재개·종료), 일시정지 시간은 길이에 미포함
- 마이크 장치 선택 · **음성 감지 시에만** 움직이는 입력 웨이브 (실시간 전사 없음)
- 약 5초마다 음성 조각 저장 · 종료 시 원본 결합 · 비정상 종료 시 `복구 필요`
- 메모: 녹음 시점 · 중요 · AI 반영 · 자동 저장 · 시점 클릭 시 원본 이동
- 종료 후 AI 동의: `[음성만 저장]` / `[AI 회의록 생성]` (선택 엔진별 전송 안내)

### AI 처리 (SCR-03)
- 단계: `SAVE_AUDIO → UPLOAD_AUDIO(또는 로컬 입력 준비) → TRANSCRIBE → GENERATE_SUMMARY → GENERATE_MINUTES → COMPLETE`
- 단계별 대기·처리·성공·실패 · 경과 시간 · 사용 중 STT·LLM 표시 (임의 % 없음)
- 실패 시 해당 단계만 재시도 · 완료 후 [회의록 검토하기]

### 회의 결과 / 검토 (SCR-04)
- **전사문:** 구간 시점 · 화자 라벨(AssemblyAI) · 화자명 수정 · 시점 재생
- **요약:** 본문 텍스트만 · 개별 재생성
- **상세:** 문서형 회의록 · 수정·저장 · AI 생성본/사용자 수정본 · 근거 재생
- **이력:** AI 생성·수정·확정·복원 (복원은 새 버전, 자동 확정 없음)
- **외부 연동:** 확정본 전송 · 이력 · 대기 취소 · 수동 재전송
- 확정 시 불변 버전 생성 · 웹훅 ON이면 [확정 및 전송] / [확정만]

### 설정 (SCR-05)
- 일반: 시간대 · 녹음 후 AI 안내 · 테마
- AI 엔진: STT(Whisper / AssemblyAI) · LLM(Ollama / OpenAI) · 연결 상태(키 미노출)
- AI 프롬프트: 요약/상세 독립 편집(20~4000자) · 기본값 복원 · 샘플 시험 생성
- 외부 연동: 웹훅 ON/OFF · 수신처 별칭 · 전송 항목 · 시험 발송
- 저장·백업 · 선택 엔진에 맞춘 데이터 처리 안내

### 외부 연동 (SCR-06)
- 기본 **웹훅 OFF** · URL은 `MAKE_WEBHOOK_URL`(서버)만 사용, UI에 미노출
- 전송 기본 항목: **상세 회의록만 ON** (음성 미전송)
- 시험 발송은 고정 샘플만 · 실제 발송은 확정본만
- 재시도 최대 4회(1분·5분·30분) · 동일 `event_id` 유지

---

## 회의 표시 상태

| 표시 | 의미 |
|---|---|
| 준비 | 회의만 생성됨 |
| 녹음 중 | 녹음 진행 |
| 저장 중 | 음성 저장 중 |
| AI 처리 중 | 전사/요약/상세 생성 |
| 검토 필요 | AI 생성 완료 |
| 확정됨 | 사용자 확정 |
| 전송 완료 | 확정 + 웹훅 성공 |
| 처리 실패 / 전송 실패 / 복구 필요 | 오류·복구 우선 표시 |

우선순위: 복구 필요 > 처리 실패 > 전송 실패 > 녹음 중 > AI 처리 중 > 검토 필요 > 확정됨 > 전송 완료

---

## AI 엔진

STT와 LLM을 각각 로컬·클라우드에서 선택합니다. 기본값은 **Whisper(로컬)** + **Ollama(로컬)** 입니다.

```text
MeetingAI
├── STT (음성 → 텍스트) … 녹음 종료 · AI 동의 후에만 실행
│   ├── Whisper      … 로컬 faster-whisper (`whisper-server` · :8080)
│   └── AssemblyAI   … 클라우드 Pre-recorded (화자 라벨 · 재조회)
└── LLM (요약 · 상세)
    ├── Ollama       … 로컬 (:11434)
    └── OpenAI       … 클라우드
```

| 구분 | 옵션 | 처리 | 상태 |
|---|---|---|---|
| STT | Whisper / AssemblyAI | 브라우저→로컬 / 서버→클라우드 | 구현 |
| LLM | Ollama / OpenAI | 브라우저→로컬 / 서버→클라우드 | 구현 |

> OpenAI 클라우드 Whisper API · Realtime 전사는 사용하지 않습니다.  
> Vercel 배포 시에도 로컬 Whisper/Ollama는 **사용자 PC**에서 실행해야 하며, 브라우저가 `127.0.0.1`로 직접 호출합니다.

---

## 데이터 저장

| 데이터 | 위치 |
|---|---|
| 회의·메모·음성·전사·AI 결과·버전·웹훅 이력·설정 | 브라우저 **IndexedDB** (`meetingai`) |
| Whisper 모델 가중치 | `whisper-server/models/` (회의 본문 아님) |
| API 키·웹훅 URL | `.env.local` / 서버 환경변수 (브라우저 미노출) |

### 저장 시점

| 동작 | IndexedDB에 남는가 |
|---|---|
| `/meetings/new` 열기만 하고 취소 | 아니오 |
| `[회의 시작]` | 예 (`meetings`) |
| 녹음 중 | 예 (`audioChunks`, 약 5초) |
| `[음성만 저장]` | 예 (`meetingAudio`, STT 없음) |
| `[AI 회의록 생성]` 완료 | 예 (`transcripts` · `generations`) |
| 확정 | 예 (`generationVersions`) |
| 웹훅 전송 | 예 (`webhookDeliveries`) |

확인: DevTools → Application → IndexedDB → `meetingai`

---

## 로컬 실행

### 1) Whisper 서버 (기본 STT)

상세: [`whisper-server/README.md`](whisper-server/README.md)

```powershell
winget install Gyan.FFmpeg   # 권장, 한 번만
cd whisper-server
.\start.ps1
```

Health: http://127.0.0.1:8080/health

### 2) Next.js 앱

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000` 으로 접속하세요. (서버는 직접 실행해 주세요.)

### 3) Ollama (기본 LLM)

```powershell
$env:OLLAMA_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
ollama serve
ollama pull qwen3:8b
```

설정 → AI 엔진에서 STT=Whisper, LLM=Ollama 확인 후 연결 테스트 → 저장

### 환경변수

| 변수 | 설명 |
|---|---|
| `STT_PROVIDER` | `whisper`(기본) / `assemblyai` |
| `WHISPER_API_URL` | `http://127.0.0.1:8080/v1/audio/transcriptions` |
| `WHISPER_MODEL` | 예: `small` |
| `ASSEMBLYAI_API_KEY` | 서버 전용 |
| `LLM_PROVIDER` | `ollama`(기본) / `openai` (UI 선택 우선) |
| `OPENAI_API_KEY` | 서버 전용 |
| `OPENAI_MODEL` | 기본 `gpt-4.1-mini-2025-04-14` |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | 예: `qwen3:8b` |
| `MAKE_WEBHOOK_URL` | 서버 전용 · Make 웹훅 URL |

API 키에 `NEXT_PUBLIC_`를 붙이지 마세요.

### Vercel + 로컬 엔진

1. Vercel Env에 클라우드 키만 설정 (`ASSEMBLYAI_API_KEY`, `OPENAI_API_KEY`, 선택 `MAKE_WEBHOOK_URL`)
2. PC에서 Whisper·Ollama 실행 (`OLLAMA_ORIGINS`에 배포 Origin 포함)
3. 배포 사이트 → 설정 → AI 엔진에서 URL 확인 · 연결 테스트

---

## 구현 경로 요약

| 경로 | 내용 |
|---|---|
| `/`, `/meetings` | SCR-01 목록 |
| `/meetings/new` | SCR-02 Step 1 |
| `/meetings/[id]/record` | SCR-02 Step 2 + SCR-03 패널 |
| `/meetings/[id]` | SCR-04 검토 · SCR-06 탭 |
| `app/api/stt/*` | 전사 · 상태 · AssemblyAI jobs |
| `app/api/generations` · `llm/status` | 요약·상세 · LLM 상태 |
| `app/api/webhooks/*` | status · test · send |
| `whisper-server/` | 로컬 faster-whisper |

**P0 MVP:** SCR-01~06 구현 완료.  
**아직 없음:** Realtime 전사, 웹훅 HMAC 서명, 전체 ZIP 백업, Slack/Teams 전용 형식

---

## 문서

| 문서 | 설명 |
|---|---|
| [docs/prd.md](docs/prd.md) | 제품 요구사항 (v0.3.7) |
| [docs/화면설계서.md](docs/화면설계서.md) | 화면별 UI/UX · AC · 구현 현황 (v0.10) |
| [whisper-server/README.md](whisper-server/README.md) | 로컬 Whisper 설치·실행 |
