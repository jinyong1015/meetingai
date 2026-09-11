"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { NoteSection } from "@/components/note/NoteSection";
import { AudioWaveform } from "@/components/recording/AudioWaveform";
import { TranscriptResultPanel } from "@/components/recording/TranscriptResultPanel";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useAppSettings } from "@/lib/hooks/useAppSettings";
import { useMeetingRecorder } from "@/lib/hooks/useMeetingRecorder";
import {
  useMicAnalyser,
  type MicAnalyserError,
} from "@/lib/hooks/useMicAnalyser";
import { getMeeting, patchMeeting } from "@/lib/storage/meetings";
import {
  deleteMeetingTranscript,
  getMeetingTranscript,
  saveMeetingTranscript,
} from "@/lib/storage/transcripts";
import type { Meeting } from "@/lib/types/meeting";
import { sttProviderLabel } from "@/lib/types/settings";
import type { TranscriptSegment } from "@/lib/types/transcript";
import { formatTimestamp } from "@/lib/utils/format-time";

type RecordingState = "idle" | "recording" | "paused";

type RecordMeetingScreenProps = {
  meetingId: string;
};

function statusLabel(state: RecordingState) {
  if (state === "recording") return "녹음 중";
  if (state === "paused") return "일시정지";
  return "준비";
}

function micErrorMessage(error: MicAnalyserError): string {
  if (error === "permission-denied") {
    return "마이크 권한이 필요합니다. 주소창 왼쪽의 자물쇠(또는 사이트 설정)에서 마이크를 허용한 뒤 다시 시도해 주세요.";
  }
  if (error === "not-found") {
    return "사용 가능한 마이크를 찾을 수 없습니다. 장치를 연결한 뒤 다시 시도해 주세요.";
  }
  if (error === "unsupported") {
    return "이 브라우저에서는 마이크 입력을 지원하지 않습니다. Chrome 등 최신 브라우저에서 열어 주세요.";
  }
  if (error === "insecure") {
    return "마이크는 보안 연결(HTTPS 또는 localhost)에서만 사용할 수 있습니다.";
  }
  return "마이크에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function RecordMeetingScreen({ meetingId }: RecordMeetingScreenProps) {
  const [meeting, setMeeting] = useState<Meeting | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [seekHint, setSeekHint] = useState<string | null>(null);
  const [micBusy, setMicBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewSegments, setReviewSegments] = useState<TranscriptSegment[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [sttPending, setSttPending] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStateRef = useRef(recordingState);
  const titleRef = useRef(title);
  const meetingLoadedRef = useRef(false);
  const recorderStartedRef = useRef(false);

  const { sttProvider } = useAppSettings();
  const {
    start: startRecorder,
    pause: pauseRecorder,
    resume: resumeRecorder,
    stop: stopRecorder,
    reset: resetRecorder,
  } = useMeetingRecorder();

  const {
    levels,
    error: micError,
    phase: micPhase,
    stream: micStream,
    start: startMic,
    stop: stopMic,
    setMuted: setMicMuted,
  } = useMicAnalyser({ active: recordingState === "recording" });

  recordingStateRef.current = recordingState;
  titleRef.current = title;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [loaded, transcript] = await Promise.all([
        getMeeting(meetingId),
        getMeetingTranscript(meetingId),
      ]);
      if (cancelled) return;
      if (!loaded) {
        setMeeting(null);
        return;
      }
      meetingLoadedRef.current = true;
      setMeeting(loaded);
      setTitle(loaded.title);
      accumulatedRef.current = loaded.durationSec;
      setElapsedSec(loaded.durationSec);
      if (transcript?.segments?.length) {
        setReviewSegments(transcript.segments);
        setShowReview(true);
      }
      if (loaded.displayStatus === "녹음 중") {
        void patchMeeting(meetingId, { displayStatus: "준비" }).then((next) => {
          if (!cancelled && next) setMeeting(next);
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  useEffect(() => {
    if (!meeting || title === meeting.title) return;
    const timer = setTimeout(() => {
      void patchMeeting(meetingId, { title: title.slice(0, 120) }).then(
        (next) => {
          if (next) setMeeting(next);
        },
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [meeting, meetingId, title]);

  useEffect(() => {
    if (recordingState !== "recording") {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    tickRef.current = setInterval(() => {
      if (startedAtRef.current === null) return;
      const live = (Date.now() - startedAtRef.current) / 1000;
      setElapsedSec(accumulatedRef.current + live);
    }, 250);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [recordingState]);

  useEffect(() => {
    if (recordingState !== "recording" || !micStream) return;
    if (recorderStartedRef.current) return;
    recorderStartedRef.current = startRecorder(micStream);
  }, [recordingState, micStream, startRecorder]);

  useEffect(() => {
    return () => {
      if (!meetingLoadedRef.current) return;
      const duration =
        recordingStateRef.current === "recording" && startedAtRef.current
          ? accumulatedRef.current + (Date.now() - startedAtRef.current) / 1000
          : accumulatedRef.current;
      void patchMeeting(meetingId, {
        title: titleRef.current.slice(0, 120),
        durationSec: Math.floor(duration),
        displayStatus: "준비",
      });
    };
  }, [meetingId]);

  async function persist(patch: Parameters<typeof patchMeeting>[1]) {
    const next = await patchMeeting(meetingId, patch);
    if (next) setMeeting(next);
  }

  async function transcribeRecording(audio: {
    blob: Blob;
    mimeType: string;
  }) {
    setSttPending(true);
    setSttError(null);
    try {
      const form = new FormData();
      const filename = `meeting.${extensionForMime(audio.mimeType)}`;
      form.append("audio", audio.blob, filename);
      form.append("language", "ko");
      form.append("provider", sttProvider);

      const res = await fetch("/api/stt/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        text?: string;
        provider?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "음성 인식에 실패했습니다.");
      }

      const text = (data.text ?? "").trim();
      const segments: TranscriptSegment[] = text
        ? [
            {
              id: `${meetingId}-full`,
              text,
              startedAtSec: 0,
              provider: data.provider ?? sttProvider,
            },
          ]
        : [];

      setReviewSegments(segments);
      await saveMeetingTranscript({
        meetingId,
        segments,
        provider: data.provider ?? sttProvider,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "음성 인식에 실패했습니다.";
      setSttError(message);
    } finally {
      setSttPending(false);
    }
  }

  async function startRecording() {
    if (recordingState !== "idle" || micBusy) return;
    flushSync(() => {
      setMicBusy(true);
      setSeekHint(null);
    });
    const ok = await startMic();
    setMicBusy(false);
    if (!ok) return;

    resetRecorder();
    recorderStartedRef.current = false;
    setReviewSegments([]);
    setShowReview(false);
    setSttError(null);
    setSttPending(false);
    void deleteMeetingTranscript(meetingId);
    startedAtRef.current = Date.now();
    accumulatedRef.current = 0;
    setElapsedSec(0);
    setRecordingState("recording");
    void persist({ displayStatus: "녹음 중", durationSec: 0 });
  }

  function pauseRecording() {
    if (recordingState !== "recording" || startedAtRef.current === null) return;
    accumulatedRef.current += (Date.now() - startedAtRef.current) / 1000;
    startedAtRef.current = null;
    setElapsedSec(accumulatedRef.current);
    pauseRecorder();
    setMicMuted(true);
    setRecordingState("paused");
    void persist({
      displayStatus: "녹음 중",
      durationSec: Math.floor(accumulatedRef.current),
    });
  }

  function resumeRecording() {
    if (recordingState !== "paused") return;
    startedAtRef.current = Date.now();
    resumeRecorder();
    setMicMuted(false);
    setRecordingState("recording");
    void persist({ displayStatus: "녹음 중" });
  }

  async function stopRecording() {
    if (recordingState === "idle") return;
    if (recordingState === "recording" && startedAtRef.current !== null) {
      accumulatedRef.current += (Date.now() - startedAtRef.current) / 1000;
    }
    startedAtRef.current = null;
    setElapsedSec(accumulatedRef.current);
    setShowReview(true);
    setSttPending(true);
    setSttError(null);

    const audio = await stopRecorder();
    recorderStartedRef.current = false;
    stopMic();
    setRecordingState("idle");
    void persist({
      displayStatus: "준비",
      durationSec: Math.floor(accumulatedRef.current),
    });

    if (!audio) {
      setSttPending(false);
      setSttError("녹음된 음성을 찾지 못했습니다.");
      return;
    }

    await transcribeRecording(audio);
  }

  const recordingElapsedSec =
    recordingState === "recording" || recordingState === "paused"
      ? elapsedSec
      : null;

  function handleSeek(seconds: number) {
    setSeekHint(
      `메모 시점 [${formatTimestamp(seconds)}] — 음성 재생은 녹음 종료·저장 후 제공됩니다.`,
    );
  }

  if (meeting === undefined) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-[var(--muted)]">
        회의를 준비하는 중…
      </div>
    );
  }

  if (meeting === null) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col items-start px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-[var(--muted)]">회의를 찾을 수 없습니다.</p>
        <Link href="/" className="btn btn-primary mt-4 px-4 py-2.5">
          회의 목록
        </Link>
      </div>
    );
  }

  const startedClock = new Date(meeting.startedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="animate-fade mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            회의 목록
          </Link>
          <div className="h-4 w-px bg-[var(--border-strong)]" aria-hidden />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            className="min-w-0 flex-1 bg-transparent font-[family-name:var(--font-display)] text-xl font-bold tracking-tight outline-none placeholder:text-[var(--muted)] sm:text-2xl"
            aria-label="회의 제목"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-white/50 px-3 py-1.5 text-xs font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
            STT {sttProviderLabel(sttProvider)}
          </span>
          <span className="rounded-lg bg-white/50 px-3 py-1.5 text-xs font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
            로컬 저장
          </span>
          <button
            type="button"
            className="btn btn-ghost h-9 px-3 text-sm"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙ 설정
          </button>
        </div>
      </header>

      <div className="animate-rise sticky top-3 z-20 mb-6">
        <div className="glass-panel overflow-hidden rounded-[var(--radius)] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex size-11 items-center justify-center rounded-2xl ${
                  recordingState === "recording"
                    ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                    : recordingState === "paused"
                      ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                      : "bg-[var(--accent-soft)] text-[var(--accent)]"
                }`}
              >
                {recordingState === "recording" ? (
                  <span
                    className="size-3 rounded-sm bg-[var(--danger)] animate-pulse-dot"
                    aria-hidden
                  />
                ) : recordingState === "paused" ? (
                  <span className="font-mono text-sm font-semibold" aria-hidden>
                    II
                  </span>
                ) : (
                  <span className="size-3 rounded-full bg-[var(--accent)]" aria-hidden />
                )}
              </div>

              <div>
                <p className="text-sm font-semibold tracking-tight">
                  {statusLabel(recordingState)}
                </p>
                <p className="font-[family-name:var(--font-mono)] text-2xl font-semibold tracking-tight tabular-nums">
                  {formatTimestamp(elapsedSec)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {recordingState === "idle" && (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  disabled={micBusy || sttPending}
                  className="btn btn-danger px-5 py-2.5"
                >
                  {micBusy ? "마이크 연결 중…" : "녹음 시작"}
                </button>
              )}
              {recordingState === "recording" && (
                <>
                  <button
                    type="button"
                    onClick={pauseRecording}
                    className="btn btn-ghost px-4 py-2.5"
                  >
                    일시정지
                  </button>
                  <button
                    type="button"
                    onClick={() => void stopRecording()}
                    className="btn btn-primary px-4 py-2.5"
                  >
                    녹음 종료
                  </button>
                </>
              )}
              {recordingState === "paused" && (
                <>
                  <button
                    type="button"
                    onClick={resumeRecording}
                    className="btn btn-accent px-4 py-2.5"
                  >
                    녹음 재개
                  </button>
                  <button
                    type="button"
                    onClick={() => void stopRecording()}
                    className="btn btn-primary px-4 py-2.5"
                  >
                    녹음 종료
                  </button>
                </>
              )}
            </div>
          </div>

          {(recordingState === "recording" || recordingState === "paused") && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--danger-soft)]/60 px-4 py-3 ring-1 ring-[var(--border)]">
              <span className="shrink-0 text-xs font-medium text-[var(--muted)]">
                입력
              </span>
              <AudioWaveform
                levels={levels}
                active={recordingState === "recording"}
                className="min-w-0 flex-1 justify-center"
              />
              <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--muted)]">
                {recordingState === "recording" ? "녹음 중" : "일시정지"}
              </span>
            </div>
          )}

          {(micBusy || micPhase === "requesting") && (
            <div
              className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 ring-1 ring-[var(--border)]"
              role="status"
              aria-live="polite"
            >
              <p className="text-sm font-semibold text-[var(--foreground)]">
                마이크 사용을 허용해 주세요
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                브라우저(또는 주소창 근처)에 표시된 권한 창에서{" "}
                <span className="font-medium text-[var(--foreground)]">허용</span>
                을 선택하면 음성 입력이 시작됩니다. 창이 보이지 않으면 주소창의
                자물쇠 아이콘에서 마이크 권한을 확인해 주세요.
              </p>
            </div>
          )}

          <p className="mt-3 text-xs text-[var(--muted)]">
            선택한 마이크로 입력되는 소리만 녹음됩니다
            {recordingState === "idle"
              ? " · 녹음 종료 후 선택한 STT로 음성을 텍스트로 변환합니다"
              : " · 녹음이 끝난 뒤 음성 인식 결과가 표시됩니다"}
          </p>

          {micError && (
            <div
              className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-4 py-3 ring-1 ring-[var(--border)]"
              role="alert"
            >
              <p className="text-sm font-semibold text-[var(--danger)]">
                마이크 권한이 필요합니다
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                {micErrorMessage(micError)}
              </p>
              <button
                type="button"
                onClick={() => void startRecording()}
                disabled={micBusy}
                className="btn btn-ghost mt-3 px-3 py-1.5 text-sm"
              >
                다시 시도
              </button>
            </div>
          )}

          {seekHint && (
            <p className="mt-2 text-sm text-[var(--accent)]" role="status">
              {seekHint}
            </p>
          )}
        </div>
      </div>

      <div
        className="animate-rise grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]"
        style={{ animationDelay: "80ms" }}
      >
        <div className="flex min-w-0 flex-col gap-6">
          {showReview && recordingState === "idle" && (
            <TranscriptResultPanel
              segments={reviewSegments}
              providerLabel={sttProviderLabel(sttProvider)}
              pending={sttPending}
              error={sttError}
            />
          )}

          <div className="glass-panel rounded-[var(--radius)] p-5 sm:p-6">
            <NoteSection
              meetingId={meetingId}
              recordingElapsedSec={recordingElapsedSec}
              onSeekTimestamp={handleSeek}
            />
          </div>
        </div>

        <aside className="h-fit lg:sticky lg:top-36">
          <div className="rounded-[var(--radius)] p-1">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              회의 정보
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs text-[var(--muted)]">시작</dt>
                <dd className="mt-1 text-base font-medium">{startedClock}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">녹음 시간</dt>
                <dd className="mt-1 font-[family-name:var(--font-mono)] text-base font-medium tabular-nums">
                  {formatTimestamp(elapsedSec)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">상태</dt>
                <dd className="mt-1 flex items-center gap-2 text-base font-medium">
                  <span
                    className={`size-2 rounded-full ${
                      recordingState === "recording"
                        ? "bg-[var(--danger)]"
                        : recordingState === "paused"
                          ? "bg-[var(--warning)]"
                          : "bg-[var(--accent)]"
                    }`}
                    aria-hidden
                  />
                  {statusLabel(recordingState)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">STT 엔진</dt>
                <dd className="mt-1 text-base font-medium">
                  {sttProviderLabel(sttProvider)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">저장</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  메모는 이 브라우저 IndexedDB에 자동 저장됩니다
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
