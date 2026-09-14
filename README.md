# AI 회의노트

회의 음성을 녹음하고, 메모와 함께 AI 회의록을 만드는 웹 앱입니다.  
기준 문서: [`docs/prd.md`](docs/prd.md), [`docs/화면설계서.md`](docs/화면설계서.md)

---

## AI 엔진 구조

STT와 LLM을 각각 로컬·클라우드 중 선택해 사용합니다.

```text
MeetingAI
├── STT (음성 → 텍스트)  … 녹음 종료 후 처리 (Realtime 미사용)
│   ├── Whisper      … 로컬 faster-whisper (`whisper-server` · :8080)
│   └── AssemblyAI   … 클라우드 Pre-recorded (선택)
└── LLM (요약 · 상세 회의록)  … 어댑터 미구현 · UI·가상 미리보기는 준비됨
    ├── Ollama       … 로컬
    └── OpenAI       … 클라우드
```

| 구분 | 옵션 | 처리 위치 | 현재 |
|---|---|---|---|
| **STT** | Whisper / AssemblyAI | **로컬 faster-whisper** / 클라우드 | **구현** (녹음 종료·동의 후) |
| **LLM** | Ollama / OpenAI | 로컬 / 클라우드 | **미구현** (결과 탭·가상 데이터 미리보기만) |

설정(SCR-05)에서 STT 엔진을 고를 수 있습니다. Whisper는 OpenAI API를 쓰지 않고 `127.0.0.1:8080` 로컬 서버만 호출합니다.

---

## 전체 진행률

| 구분 | 진행률 | 설명 |
|---|---:|---|
| **P0 MVP (출시 필수)** | **약 62%** | 목록·생성·녹음·조각 저장·원본 재생·AI 동의·STT·결과 탭·상세 수정 |
| P1 (후속) | 0% | 미착수 |
| P2 / Future | 0% | 미착수 (실시간 전사 포함) |

> 진행률은 화면설계서 **P0 필수 항목**을 기준으로 산정했습니다.

---

## 진행 목차 (P0)

### 1. 기반 작업 — 완료
- [x] Next.js 프로젝트 구성
- [x] PRD / 화면설계서 문서
- [x] 공통 UI 톤 (글래스·틸 액센트)
- [x] IndexedDB 공통 레이어 (`meetings` · `notes` · `settings` · `transcripts` · `generations`)

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

### 3. SCR-02 새 회의 / 녹음 — 약 95%
- [x] 새 회의 생성 폼 (`/meetings/new`) — 제목·일시·참석자·태그
- [x] **`[회의 시작]` 시에만 IndexedDB 저장**
- [x] 생성 후 `/meetings/{meetingId}/record` 이동
- [x] 녹음 제어 (시작 · 일시정지 · 재개 · 종료)
- [x] 경과 시간 타이머 (일시정지 제외)
- [x] `getUserMedia` 마이크 권한 · 권한 안내 UX
- [x] `MediaRecorder` 음성 수집 (`audio/webm;codecs=opus` 우선)
- [x] 입력 레벨 웨이브 — **실제 음성(RMS·말소리 대역) 감지 시에만 반응** (`useMicAnalyser`)
- [x] 녹음 종료 확인 모달
- [x] 음성 조각 로컬 저장 · 복구 (REC-04, 약 5초)
- [x] 원본 재생 · 다운로드 (REC-06)
- [x] AI 처리 · 엔진별 전송 동의 UX (음성만 저장 / AI 생성 → STT)
- [x] 마이크 장치 선택 · 입력 확인
- [x] 녹음 종료 후 동의 시 STT 전사
- [x] 회의 결과 탭 (**전사문 · 요약 · 상세**, 기본 탭=전사문)
- [x] 가상 데이터로 요약·상세 미리보기 (녹음 없이 UI 확인)
- [x] 전사문 · 생성 결과 IndexedDB 저장 · 새로고침 복원
- [ ] SCR-03 LLM 요약·상세 실제 생성 (동의 후 STT까지 · LLM은 후속)

### 4. 메모 입력 (NOTE-01~05) — 완료
- [x] 메모 추가 · 수정 · 삭제
- [x] 회의당 20,000자 제한
- [x] 녹음 중 시점 표시
- [x] 중요 · AI 반영 토글
- [x] 자동 저장 (1초 / 최대 5초)
- [x] 저장 상태 표시
- [x] IndexedDB 로컬 저장 · 새로고침 복원
- [x] 시점 클릭 시 실제 음성 위치 이동 (원본 플레이어 연동)

### 5. STT (녹음 종료 후) — 약 70%
- [x] STT 어댑터 인터페이스 (`assemblyai` · `whisper`)
- [x] AssemblyAI **Pre-recorded** (`universal-2`, `language_code: ko`)
- [x] Whisper 어댑터 (`WHISPER_API_URL` OpenAI 호환)
- [x] `POST /api/stt/transcribe` · `GET /api/stt/status`
- [x] 설정에서 STT 엔진 선택 · 연결 상태 표시
- [ ] 화자 구분 · 구간별 시점 (AI-03)
- [ ] SCR-03 처리 단계 UI · 재조회(AI-05)

### 6. SCR-03 AI 처리 (LLM) — 약 10%
- [ ] LLM 어댑터 (Ollama · OpenAI)
- [ ] 실제 LLM 요약 · 상세 생성 API
- [x] 가상 데이터로 요약·상세 결과 미리보기 (녹음 화면)
- [ ] 처리 단계 · 경과 시간 · 사용 엔진 UI
- [ ] 외부 전송 동의 UX

### 7. SCR-04 회의 결과 / 검토 — 약 45%
- [x] 전사문 · 요약 · 상세 탭 조회 (녹음 화면에 임시 배치, 전용 Route 미분리)
- [x] 요약: 회의 내용 요약 텍스트만 표시
- [x] 상세: 문서형 회의록(제목·일시·장소·참석자·안건·결정·액션·다음 회의 등)
- [x] 상세 회의록 **사용자 수정 · 저장** (IndexedDB `generations`)
- [ ] 전용 Route `/meetings/{meetingId}` 분리
- [ ] 원본 음성 재생 · 다운로드
- [ ] 확정 · 버전 관리 · 근거 재생
- [ ] 이력 · 외부 연동 탭

### 8. SCR-05 설정 — 약 35%
- [x] 헤더·녹음 화면 설정 대화상자
- [x] AI 엔진 탭: **STT 선택** (Whisper · AssemblyAI)
- [x] 엔진 연결 상태 (환경변수 설정 여부, 키 미노출)
- [ ] 일반 설정
- [ ] LLM 엔진 선택
- [ ] AI 프롬프트 관리
- [x] 목록 하단 백업·복원

### 9. SCR-06 외부 연동 — 0%
- [ ] 웹훅 수신처 설정
- [ ] 확정본 전송 · 이력

---

## 현재까지 만든 것 (요약)

| 경로 | 내용 |
|---|---|
| `/`, `/meetings` | SCR-01 회의 목록 · 검색 · 필터 · 삭제 · 백업 |
| `/meetings/new` | SCR-02 Step 1 새 회의 생성 |
| `/meetings/[meetingId]/record` | 녹음 · 메모 · 조각 저장 · 원본 재생 · AI 동의 · STT · 결과 탭 · 가상 미리보기 |
| `app/api/stt/*` | 전사 · 엔진 상태 (서버 전용 키) |
| `components/recording/*` | RecordMeetingScreen · AudioWaveform · AudioPlayer · AiConsentDialog |
| `components/review/*` | MeetingResultTabs · SummaryPanel · DetailPanel(조회·수정) |
| `components/settings/*` | SettingsDialog (STT 선택) |
| `lib/hooks/useMicAnalyser` | AnalyserNode · 장치 선택 · 적응형 노이즈 게이트 · `voiceActive` |
| `lib/mocks/virtualMeetingResult` | 가상 전사·요약·상세 샘플 |
| `lib/stt/*` | AssemblyAI · Whisper 어댑터 |
| `lib/storage/*` | IndexedDB (`meetings` · `notes` · `settings` · `transcripts` · `generations` · `audioChunks` · `meetingAudio`) |

**아직 없음:** 실제 LLM 연동, SCR-03 처리 단계 UI, SCR-04 전용 Route·확정·웹훅, 실시간(Realtime) 전사

### 저장 시점 (중요)

| 동작 | 목록에 남는가 |
|---|---|
| `/meetings/new` 열기만 하고 취소·목록으로 복귀 | 아니오 |
| `[회의 시작]` 클릭 | 예 (IndexedDB에 회의 생성 후 녹음 화면) |
| 녹음 중 | 예 (`audioChunks`에 약 5초 간격 조각 저장) |
| 녹음 종료 후 `[음성만 저장]` | 예 (`meetingAudio`만 · STT 없음) |
| 녹음 종료 후 `[AI 회의록 생성]` · STT 완료 | 예 (`transcripts`에 전사문 저장) |
| 가상 미리보기 / 상세 수정 저장 | 예 (`generations` · `summaryPreview` 갱신) |

---

## 로컬 실행

### 1) 로컬 Whisper 서버 (필수 · STT)

OpenAI API 없이 **faster-whisper**가 `localhost:8080`에서  
`POST /v1/audio/transcriptions` 를 제공합니다. 상세: [`whisper-server/README.md`](whisper-server/README.md)

```powershell
# ffmpeg (webm 디코딩) — 한 번만
winget install Gyan.FFmpeg
# 터미널을 닫았다가 다시 연 뒤:

cd whisper-server
.\start.ps1
```

Health 확인: http://127.0.0.1:8080/health

### 2) Next.js 앱

```bash
npm install
cp .env.example .env.local   # 이미 whisper 기본값으로 채워 둠
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 → **설정**에서 STT = Whisper 저장  
→ 녹음 종료 → AI 동의 → **AI 회의록 생성**

### 환경변수 (`.env.local`)

| 변수 | 설명 |
|---|---|
| `STT_PROVIDER` | `whisper` (기본) 또는 `assemblyai` |
| `WHISPER_API_URL` | `http://127.0.0.1:8080/v1/audio/transcriptions` |
| `WHISPER_MODEL` | 로컬 모델 크기 (`small` 권장) |
| `WHISPER_API_KEY` | 로컬 서버는 불필요 |
| `ASSEMBLYAI_API_KEY` | AssemblyAI 사용 시에만 |

> `NEXT_PUBLIC_` 접두사로 API 키를 두지 마세요. 브라우저에 노출됩니다.

---

## 다음에 할 일 (권장 순서)

1. 녹음 종료 → AI 동의 → **SCR-03** (실제 LLM 요약·상세)  
2. **SCR-04** 전용 Route · 확정 · **SCR-06** 웹훅  
3. SCR-05 일반 설정 · LLM · 프롬프트 본편

---

## 문서

| 문서 | 설명 |
|---|---|
| [docs/prd.md](docs/prd.md) | 제품 요구사항 (v0.3.4) |
| [docs/화면설계서.md](docs/화면설계서.md) | 화면별 UI/UX · AC · 구현 현황 (v0.7) |
