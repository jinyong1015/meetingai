"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { NoteSection } from "@/components/note/NoteSection";
import { AiConsentDialog } from "@/components/recording/AiConsentDialog";
import { AiProcessingPanel } from "@/components/recording/AiProcessingPanel";
import { AudioPlayer } from "@/components/recording/AudioPlayer";
import { AudioWaveform } from "@/components/recording/AudioWaveform";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import {
  createInitialProcessingSteps,
  patchStep,
  type AiProcessingStep,
  type AiProcessingStepId,
} from "@/lib/ai/processing";
import { useAppSettings } from "@/lib/hooks/useAppSettings";
import { useMeetingRecorder } from "@/lib/hooks/useMeetingRecorder";
import {
  useMicAnalyser,
  type MicAnalyserError,
} from "@/lib/hooks/useMicAnalyser";
import {
  VIRTUAL_SUMMARY_TEXT,
  VIRTUAL_TRANSCRIPT_SEGMENTS,
  buildVirtualDetailMinutes,
} from "@/lib/mocks/virtualMeetingResult";
import { buildGenerationInputFingerprint } from "@/lib/review/inputFingerprint";
import {
  deleteMeetingAudioData,
  loadPlayableMeetingAudio,
  saveAudioChunk,
  saveMeetingAudio,
} from "@/lib/storage/audio";
import {
  deleteMeetingGeneration,
  getMeetingGeneration,
  saveMeetingGeneration,
} from "@/lib/storage/generations";
import { getMeeting, patchMeeting } from "@/lib/storage/meetings";
import { getNotesByMeeting } from "@/lib/storage/notes";
import {
  deleteMeetingTranscript,
  getMeetingTranscript,
  saveMeetingTranscript,
} from "@/lib/storage/transcripts";
import {
  createGenerationVersion,
  deleteGenerationVersionsByMeeting,
} from "@/lib/storage/versions";
import { mapSttSegmentsToTranscript } from "@/lib/stt/mapSegments";
import type { SttSegmentResult } from "@/lib/stt/types";
import type { MeetingAudio } from "@/lib/types/audio";
import type { MeetingDetailMinutes } from "@/lib/types/detail";
import { formatDetailMinutesText } from "@/lib/types/detail";
import type { Meeting } from "@/lib/types/meeting";
import { sttProviderLabel, llmProviderLabel } from "@/lib/types/settings";
import {
  buildFullText,
  type TranscriptSegment,
} from "@/lib/types/transcript";
import { createId, formatTimestamp } from "@/lib/utils/format-time";

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
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [micBusy, setMicBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [reviewSegments, setReviewSegments] = useState<TranscriptSegment[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [sttPending, setSttPending] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [diarizationSupported, setDiarizationSupported] = useState(false);
  const [processingActive, setProcessingActive] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<AiProcessingStep[]>(
    () => createInitialProcessingSteps("whisper"),
  );
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(
    null,
  );
  const [processingTickMs, setProcessingTickMs] = useState(0);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [detailText, setDetailText] = useState<string | null>(null);
  const [detailMinutes, setDetailMinutes] =
    useState<MeetingDetailMinutes | null>(null);
  const [summarySourceLabel, setSummarySourceLabel] = useState<string | null>(
    null,
  );
  const [generationSource, setGenerationSource] = useState<"mock" | "llm">(
    "llm",
  );
  const [summaryPending, setSummaryPending] = useState(false);
  const [detailPending, setDetailPending] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [llmConfigured, setLlmConfigured] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [savedAudio, setSavedAudio] = useState<MeetingAudio | null>(null);
  const [audioRecovered, setAudioRecovered] = useState(false);
  const [audioSaveError, setAudioSaveError] = useState<string | null>(null);
  const [lastChunkSavedAt, setLastChunkSavedAt] = useState<string | null>(null);
  const [seekToSec, setSeekToSec] = useState<number | null>(null);
  const [pendingAudio, setPendingAudio] = useState<{
    blob: Blob;
    mimeType: string;
    sessionId: string;
    durationSec: number;
    lastChunkSavedAt: string | null;
  } | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStateRef = useRef(recordingState);
  const titleRef = useRef(title);
  const meetingLoadedRef = useRef(false);
  const recorderStartedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const lastChunkSavedAtRef = useRef<string | null>(null);
  const chunkPersistErrorRef = useRef(false);
  const stepStartedAtRef = useRef<Partial<Record<AiProcessingStepId, number>>>(
    {},
  );
  const processingStepsRef = useRef(processingSteps);
  const reviewSegmentsRef = useRef(reviewSegments);

  const {
    sttProvider,
    llmProvider,
    askAiAfterRecording,
    summaryPrompt,
    detailPrompt,
    summaryPromptVersion,
    detailPromptVersion,
  } = useAppSettings();
  const settingsRef = useRef({
    askAiAfterRecording,
    summaryPrompt,
    detailPrompt,
    summaryPromptVersion,
    detailPromptVersion,
  });
  settingsRef.current = {
    askAiAfterRecording,
    summaryPrompt,
    detailPrompt,
    summaryPromptVersion,
    detailPromptVersion,
  };
  processingStepsRef.current = processingSteps;
  reviewSegmentsRef.current = reviewSegments;
  const {
    start: startRecorder,
    pause: pauseRecorder,
    resume: resumeRecorder,
    stop: stopRecorder,
    reset: resetRecorder,
  } = useMeetingRecorder();

  const {
    levels,
    voiceActive,
    error: micError,
    phase: micPhase,
    stream: micStream,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    start: startMic,
    stop: stopMic,
    setMuted: setMicMuted,
  } = useMicAnalyser({
    active: recordingState === "recording" || recordingState === "idle",
  });

  recordingStateRef.current = recordingState;
  titleRef.current = title;

  function beginStep(id: AiProcessingStepId, detail?: string) {
    stepStartedAtRef.current[id] = Date.now();
    setProcessingSteps((prev) =>
      patchStep(prev, id, {
        status: "running",
        detail,
        error: undefined,
      }),
    );
  }

  function finishStep(
    id: AiProcessingStepId,
    status: "success" | "failed" | "skipped",
    detail?: string,
    error?: string,
  ) {
    const started = stepStartedAtRef.current[id];
    const elapsed =
      started != null ? Math.max(0, Date.now() - started) : 0;
    setProcessingSteps((prev) => {
      const current = prev.find((step) => step.id === id);
      return patchStep(prev, id, {
        status,
        elapsedMs: (current?.elapsedMs ?? 0) + elapsed,
        detail,
        error,
      });
    });
    delete stepStartedAtRef.current[id];
  }

  function startProcessingPipeline() {
    const steps = createInitialProcessingSteps(sttProvider);
    setProcessingSteps(steps);
    setProcessingActive(true);
    setProcessingStartedAt(Date.now());
    setProcessingTickMs(0);
    setShowReview(false);
    stepStartedAtRef.current = {};
  }

  useEffect(() => {
    if (!processingActive || processingStartedAt == null) return;
    const timer = setInterval(() => {
      setProcessingTickMs(Date.now() - processingStartedAt);
      setProcessingSteps((prev) =>
        prev.map((step) => {
          if (step.status !== "running") return step;
          const started = stepStartedAtRef.current[step.id];
          if (started == null) return step;
          return { ...step, elapsedMs: Date.now() - started };
        }),
      );
    }, 250);
    return () => clearInterval(timer);
  }, [processingActive, processingStartedAt]);

  useEffect(() => {
    let cancelled = false;
    async function loadLlmStatus() {
      try {
        const res = await fetch("/api/llm/status", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          engines?: {
            openai?: { configured?: boolean };
            ollama?: { configured?: boolean };
          };
        };
        const engine = data.engines?.[llmProvider];
        setLlmConfigured(Boolean(engine?.configured));
      } catch {
        if (!cancelled) setLlmConfigured(false);
      }
    }
    void loadLlmStatus();
    return () => {
      cancelled = true;
    };
  }, [llmProvider]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [loaded, transcript, generation, playable] = await Promise.all([
        getMeeting(meetingId),
        getMeetingTranscript(meetingId),
        getMeetingGeneration(meetingId),
        loadPlayableMeetingAudio(meetingId),
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
      if (generation) {
        setSummaryText(generation.summaryText);
        setDetailText(generation.detailText);
        setDetailMinutes(generation.detailMinutes ?? null);
        setSummarySourceLabel(
          generation.source === "mock"
            ? "가상 데이터 미리보기"
            : generation.model
              ? `${llmProviderLabel(llmProvider)} · ${generation.model}`
              : llmProviderLabel(llmProvider),
        );
        setGenerationSource(generation.source);
      }
      if (transcript?.segments?.length) {
        setReviewSegments(transcript.segments);
        setDiarizationSupported(Boolean(transcript.diarizationSupported));
      }
      if (
        transcript?.segments?.length ||
        generation?.summaryText ||
        generation?.detailMinutes ||
        generation?.detailText
      ) {
        setShowReview(true);
      }

      // AI-05: resume pending AssemblyAI job without creating a new request
      if (
        transcript?.status === "pending" &&
        transcript.remoteJobId &&
        transcript.provider === "assemblyai"
      ) {
        setProcessingActive(true);
        setProcessingSteps(createInitialProcessingSteps("assemblyai"));
        setProcessingStartedAt(Date.now());
        beginStep("transcribe", "기존 전사 작업 재조회");
        setSttPending(true);
        void (async () => {
          try {
            const res = await fetch(
              `/api/stt/jobs/${encodeURIComponent(transcript.remoteJobId!)}?provider=assemblyai`,
              { cache: "no-store" },
            );
            const data = (await res.json()) as {
              status?: string;
              text?: string;
              segments?: SttSegmentResult[];
              diarizationSupported?: boolean;
              model?: string;
              error?: string;
            };
            if (cancelled) return;
            if (!res.ok || data.status === "error") {
              throw new Error(data.error || "기존 전사 작업 조회에 실패했습니다.");
            }
            if (data.status === "completed") {
              const segments = mapSttSegmentsToTranscript(
                meetingId,
                "assemblyai",
                data.segments ?? [],
              );
              setReviewSegments(segments);
              setDiarizationSupported(Boolean(data.diarizationSupported));
              await saveMeetingTranscript({
                meetingId,
                segments,
                provider: "assemblyai",
                model: data.model,
                diarizationSupported: Boolean(data.diarizationSupported),
                remoteJobId: transcript.remoteJobId,
                status: "completed",
              });
              finishStep("transcribe", "success", "기존 전사 사용");
              setSttPending(false);
              const text = buildFullText(segments);
              if (text) await generateWithLlm(text, "both");
              else {
                setProcessingActive(false);
                setShowReview(true);
              }
            } else {
              // still processing — keep polling lightly
              finishStep(
                "transcribe",
                "failed",
                undefined,
                "전사가 아직 완료되지 않았습니다. 잠시 후 다시 시도하세요.",
              );
              setSttPending(false);
              setShowReview(true);
            }
          } catch (err) {
            if (cancelled) return;
            const message =
              err instanceof Error
                ? err.message
                : "기존 전사 작업 조회에 실패했습니다.";
            setSttError(message);
            finishStep("transcribe", "failed", undefined, message);
            setSttPending(false);
            setShowReview(true);
          }
        })();
      }
      if (playable?.audio) {
        let audio = playable.audio;
        if (playable.recoveredFromChunks) {
          try {
            audio = await saveMeetingAudio({
              meetingId,
              sessionId: playable.audio.sessionId,
              blob: playable.audio.blob,
              mimeType: playable.audio.mimeType,
              durationSec: loaded.durationSec,
              lastChunkSavedAt: playable.audio.lastChunkSavedAt,
            });
          } catch {
            // Keep in-memory recovered blob even if persist fails.
          }
          void patchMeeting(meetingId, { displayStatus: "복구 필요" }).then(
            (next) => {
              if (!cancelled && next) setMeeting(next);
            },
          );
        }
        if (cancelled) return;
        setSavedAudio(audio);
        setAudioRecovered(playable.recoveredFromChunks);
        setLastChunkSavedAt(audio.lastChunkSavedAt);
      }
      if (loaded.displayStatus === "녹음 중") {
        void patchMeeting(meetingId, {
          displayStatus: playable?.recoveredFromChunks ? "복구 필요" : "준비",
        }).then((next) => {
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
    const sessionId = sessionIdRef.current ?? createId("session");
    sessionIdRef.current = sessionId;
    recorderStartedRef.current = startRecorder(micStream, {
      onChunk: (event) => {
        void saveAudioChunk({
          meetingId,
          sessionId,
          sequence: event.sequence,
          blob: event.blob,
          mimeType: event.mimeType,
        })
          .then((chunk) => {
            lastChunkSavedAtRef.current = chunk.savedAt;
            setLastChunkSavedAt(chunk.savedAt);
            chunkPersistErrorRef.current = false;
            setAudioSaveError(null);
          })
          .catch(() => {
            chunkPersistErrorRef.current = true;
            setAudioSaveError(
              "음성 조각을 저장하지 못했습니다. 녹음은 계속되며, 종료 시 다시 시도합니다.",
            );
          });
      },
    });
  }, [recordingState, micStream, startRecorder, meetingId]);

  useEffect(() => {
    return () => {
      if (!meetingLoadedRef.current) return;
      const duration =
        recordingStateRef.current === "recording" && startedAtRef.current
          ? accumulatedRef.current + (Date.now() - startedAtRef.current) / 1000
          : accumulatedRef.current;
      const patch: Parameters<typeof patchMeeting>[1] = {
        title: titleRef.current.slice(0, 120),
        durationSec: Math.floor(duration),
      };
      if (recordingStateRef.current !== "idle") {
        patch.displayStatus = "준비";
      }
      void patchMeeting(meetingId, patch);
    };
  }, [meetingId]);

  async function persist(patch: Parameters<typeof patchMeeting>[1]) {
    const next = await patchMeeting(meetingId, patch);
    if (next) setMeeting(next);
  }

  async function persistFinalAudio(input: {
    blob: Blob;
    mimeType: string;
    sessionId: string;
    durationSec: number;
    lastChunkSavedAt: string | null;
  }) {
    setAudioSaveError(null);
    void persist({ displayStatus: "저장 중" });
    try {
      const saved = await saveMeetingAudio({
        meetingId,
        sessionId: input.sessionId,
        blob: input.blob,
        mimeType: input.mimeType,
        durationSec: input.durationSec,
        lastChunkSavedAt: input.lastChunkSavedAt,
      });
      setSavedAudio(saved);
      setAudioRecovered(false);
      setLastChunkSavedAt(saved.lastChunkSavedAt);
      await persist({ displayStatus: "준비" });
      return saved;
    } catch {
      setAudioSaveError("음성을 저장하지 못했습니다.");
      void persist({ displayStatus: "복구 필요" });
      return null;
    }
  }

  async function generateWithLlm(
    transcriptText: string,
    kind: "summary" | "detail" | "both" = "both",
  ) {
    if (!llmConfigured) {
      const message = `${llmProviderLabel(llmProvider)}에 연결할 수 없어 요약·상세를 생성하지 않았습니다. 설정과 .env.local을 확인한 뒤 개발 서버를 다시 시작하세요.`;
      setLlmError(message);
      if (kind === "summary" || kind === "both") {
        finishStep("generate_summary", "failed", undefined, message);
      }
      if (kind === "detail" || kind === "both") {
        finishStep("generate_minutes", "failed", undefined, message);
      }
      setProcessingActive(false);
      setShowReview(true);
      return;
    }

    setLlmError(null);
    setGenerationSource("llm");
    void persist({ displayStatus: "AI 처리 중" });

    const runSummary = kind === "summary" || kind === "both";
    const runDetail = kind === "detail" || kind === "both";

    if (runSummary) {
      setSummaryPending(true);
      beginStep("generate_summary", llmProviderLabel(llmProvider));
    }
    if (runDetail) {
      setDetailPending(true);
      beginStep("generate_minutes", llmProviderLabel(llmProvider));
    }

    try {
      const notes = await getNotesByMeeting(meetingId);
      const aiNotes = notes
        .filter((note) => note.includeInAI && note.content.trim())
        .map((note) => ({
          content: note.content,
          timestampSec: note.timestampSec,
          important: note.important,
        }));

      const prompts = settingsRef.current;
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          provider: llmProvider,
          meeting: {
            title: titleRef.current,
            startedAt: meeting?.startedAt ?? "",
            attendees: meeting?.attendees ?? "",
            tags: meeting?.tags ?? [],
          },
          transcript: transcriptText,
          notes: aiNotes,
          summaryPrompt: prompts.summaryPrompt,
          detailPrompt: prompts.detailPrompt,
          summaryPromptVersion: prompts.summaryPromptVersion,
          detailPromptVersion: prompts.detailPromptVersion,
        }),
      });

      const data = (await res.json()) as {
        summaryText?: string;
        detailText?: string;
        detailMinutes?: MeetingDetailMinutes;
        model?: string;
        provider?: string;
        errors?: { summary?: string; detail?: string };
        error?: string;
      };

      if (!res.ok && !data.summaryText && !data.detailText) {
        throw new Error(data.error || "회의록 생성에 실패했습니다.");
      }

      const summary = data.summaryText?.trim() || null;
      const detailBody = data.detailText?.trim() || null;
      const detail = data.detailMinutes ?? null;
      const engineLabel = llmProviderLabel(llmProvider);
      const sourceLabel = data.model
        ? `${engineLabel} · ${data.model}`
        : engineLabel;

      if (runSummary) {
        if (summary) {
          setSummaryText(summary);
          setSummarySourceLabel(sourceLabel);
          finishStep(
            "generate_summary",
            "success",
            data.model ? data.model : engineLabel,
          );
        } else {
          const err =
            data.errors?.summary || data.error || "요약 생성에 실패했습니다.";
          finishStep("generate_summary", "failed", undefined, err);
          setLlmError(err);
        }
        setSummaryPending(false);
      }

      if (runDetail) {
        if (detail && detailBody) {
          setDetailMinutes(detail);
          setDetailText(detailBody);
          finishStep(
            "generate_minutes",
            "success",
            data.model ? data.model : engineLabel,
          );
        } else {
          const err =
            data.errors?.detail ||
            data.error ||
            "상세 회의록 생성에 실패했습니다.";
          finishStep("generate_minutes", "failed", undefined, err);
          setLlmError((prev) => (prev ? `${prev} · ${err}` : err));
        }
        setDetailPending(false);
      }

      if (summary || detailBody || detail) {
        const transcriptRow = await getMeetingTranscript(meetingId);
        const fingerprint = buildGenerationInputFingerprint({
          segments: transcriptRow?.segments ?? reviewSegments,
          notes,
        });
        const existing = await getMeetingGeneration(meetingId);
        await saveMeetingGeneration({
          meetingId,
          summaryText: runSummary ? summary : undefined,
          detailText: runDetail ? detailBody : undefined,
          detailMinutes: runDetail ? detail : undefined,
          inputFingerprint: fingerprint,
          source: "llm",
          llmProvider,
          model: data.model,
          preserveAsAiOriginal: true,
        });
        await createGenerationVersion({
          meetingId,
          kind: existing ? "ai_regenerated" : "ai_initial",
          summaryText: runSummary
            ? summary
            : (existing?.summaryText ?? summaryText),
          detailText: runDetail
            ? detailBody
            : (existing?.detailText ?? detailText),
          detailMinutes: runDetail
            ? detail
            : (existing?.detailMinutes ?? detailMinutes),
          source: "llm",
        });
      }

      if (summary) {
        await persist({
          summaryPreview:
            summary.split("\n").find((line) => line.trim()) ?? summary,
          displayStatus: "검토 필요",
        });
      } else {
        await persist({ displayStatus: "검토 필요" });
      }

      const hasFailure =
        (runSummary && !summary) || (runDetail && !(detail && detailBody));
      if (!hasFailure) {
        finishStep("complete", "success");
        setProcessingActive(false);
        setShowReview(true);
        router.push(`/meetings/${meetingId}`);
      } else {
        setShowReview(true);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "회의록 생성에 실패했습니다.";
      setLlmError(message);
      if (runSummary) {
        finishStep("generate_summary", "failed", undefined, message);
      }
      if (runDetail) {
        finishStep("generate_minutes", "failed", undefined, message);
      }
      await persist({ displayStatus: "처리 실패" });
      setShowReview(true);
    } finally {
      setSummaryPending(false);
      setDetailPending(false);
    }
  }

  async function transcribeRecording(audio: {
    blob: Blob;
    mimeType: string;
  }) {
    startProcessingPipeline();
    beginStep(
      "upload_audio",
      sttProvider === "whisper" ? "로컬 파일 준비" : "클라우드 업로드",
    );
    setSttPending(true);
    setSttError(null);
    setLlmError(null);
    void persist({ displayStatus: "AI 처리 중" });

    try {
      // Mark upload/prep quickly — actual bytes progress is only for measured uploads
      await new Promise((resolve) => setTimeout(resolve, 120));
      finishStep(
        "upload_audio",
        "success",
        sttProvider === "whisper"
          ? "로컬 입력 준비 완료"
          : `${(audio.blob.size / (1024 * 1024)).toFixed(1)} MiB`,
      );

      beginStep("transcribe", sttProviderLabel(sttProvider));

      if (sttProvider === "assemblyai") {
        const startForm = new FormData();
        const filename = `meeting.${extensionForMime(audio.mimeType)}`;
        startForm.append("audio", audio.blob, filename);
        startForm.append("language", "ko");
        startForm.append("provider", "assemblyai");

        const startRes = await fetch("/api/stt/jobs", {
          method: "POST",
          body: startForm,
        });
        const started = (await startRes.json()) as {
          remoteJobId?: string;
          model?: string;
          error?: string;
        };
        if (!startRes.ok || !started.remoteJobId) {
          throw new Error(started.error || "전사 작업 시작에 실패했습니다.");
        }

        await saveMeetingTranscript({
          meetingId,
          segments: [],
          provider: "assemblyai",
          model: started.model,
          remoteJobId: started.remoteJobId,
          status: "pending",
          diarizationSupported: false,
        });

        const deadline = Date.now() + 90_000;
        type PollPayload = {
          status?: string;
          text?: string;
          segments?: SttSegmentResult[];
          diarizationSupported?: boolean;
          model?: string;
          remoteJobId?: string | null;
          error?: string;
        };
        let data: PollPayload | null = null;

        while (Date.now() < deadline) {
          const pollRes = await fetch(
            `/api/stt/jobs/${encodeURIComponent(started.remoteJobId)}?provider=assemblyai`,
            { cache: "no-store" },
          );
          data = (await pollRes.json()) as PollPayload;
          if (!pollRes.ok) {
            throw new Error(data.error || "전사 상태 조회에 실패했습니다.");
          }
          if (data.status === "completed") break;
          if (data.status === "error") {
            throw new Error(data.error || "AssemblyAI 전사에 실패했습니다.");
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (!data || data.status !== "completed") {
          throw new Error("AssemblyAI 전사 대기 시간이 초과되었습니다.");
        }

        const segments = mapSttSegmentsToTranscript(
          meetingId,
          "assemblyai",
          data.segments ?? [],
        );
        setReviewSegments(segments);
        setDiarizationSupported(Boolean(data.diarizationSupported));
        await saveMeetingTranscript({
          meetingId,
          segments,
          provider: "assemblyai",
          model: data.model ?? started.model,
          diarizationSupported: Boolean(data.diarizationSupported),
          remoteJobId: started.remoteJobId,
          status: "completed",
        });

        finishStep(
          "transcribe",
          "success",
          data.diarizationSupported
            ? `${segments.length}개 구간 · 화자 구분`
            : `${segments.length}개 구간`,
        );
        setSttPending(false);

        const text = buildFullText(segments);
        if (!text) {
          setLlmError(
            "전사 결과가 비어 있어 요약·상세를 생성하지 않았습니다.",
          );
          finishStep("generate_summary", "skipped", "전사 결과 없음");
          finishStep("generate_minutes", "skipped", "전사 결과 없음");
          finishStep("complete", "failed", undefined, "전사 결과 없음");
          setProcessingActive(false);
          setShowReview(true);
          await persist({ displayStatus: "검토 필요" });
          return;
        }

        await generateWithLlm(text, "both");
        return;
      }

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
        model?: string;
        segments?: SttSegmentResult[];
        diarizationSupported?: boolean;
        remoteJobId?: string | null;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "음성 인식에 실패했습니다.");
      }

      const provider = data.provider ?? sttProvider;
      const segments = mapSttSegmentsToTranscript(
        meetingId,
        provider,
        data.segments?.length
          ? data.segments
          : data.text?.trim()
            ? [
                {
                  id: `${meetingId}-full`,
                  text: data.text.trim(),
                  startedAtSec: 0,
                  speakerLabel: "화자 A",
                  originalSpeakerLabel: "A",
                },
              ]
            : [],
      );

      setReviewSegments(segments);
      setDiarizationSupported(Boolean(data.diarizationSupported));
      await saveMeetingTranscript({
        meetingId,
        segments,
        provider,
        model: data.model,
        diarizationSupported: Boolean(data.diarizationSupported),
        remoteJobId: data.remoteJobId ?? null,
        status: "completed",
      });

      finishStep(
        "transcribe",
        "success",
        data.diarizationSupported
          ? `${segments.length}개 구간 · 화자 구분`
          : `${segments.length}개 구간`,
      );
      setSttPending(false);

      const text = buildFullText(segments);
      if (!text) {
        setLlmError(
          "전사 결과가 비어 있어 요약·상세를 생성하지 않았습니다.",
        );
        finishStep(
          "generate_summary",
          "skipped",
          "전사 결과 없음",
        );
        finishStep(
          "generate_minutes",
          "skipped",
          "전사 결과 없음",
        );
        finishStep("complete", "failed", undefined, "전사 결과 없음");
        setProcessingActive(false);
        setShowReview(true);
        await persist({ displayStatus: "검토 필요" });
        return;
      }

      await generateWithLlm(text, "both");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "음성 인식에 실패했습니다.";
      setSttError(message);
      finishStep("transcribe", "failed", undefined, message);
      setShowReview(true);
      await persist({ displayStatus: "처리 실패" });
    } finally {
      setSttPending(false);
    }
  }

  async function handleRetryStep(stepId: AiProcessingStepId) {
    if (stepId === "transcribe") {
      const audio = pendingAudio ?? savedAudio;
      if (!audio) {
        setSttError("저장된 음성을 찾지 못했습니다.");
        return;
      }
      void transcribeRecording(audio);
      return;
    }

    const transcriptText = buildFullText(reviewSegmentsRef.current);
    if (!transcriptText.trim()) {
      setLlmError("전사가 없어 재생성할 수 없습니다.");
      return;
    }

    setProcessingActive(true);
    if (processingStartedAt == null) setProcessingStartedAt(Date.now());
    if (stepId === "generate_summary") {
      await generateWithLlm(transcriptText, "summary");
    } else if (stepId === "generate_minutes") {
      await generateWithLlm(transcriptText, "detail");
    }
  }

  async function handleSpeakerChange(segmentId: string, speakerLabel: string) {
    const next = reviewSegmentsRef.current.map((segment) =>
      segment.id === segmentId ? { ...segment, speakerLabel } : segment,
    );
    setReviewSegments(next);
    await saveMeetingTranscript({
      meetingId,
      segments: next,
      provider: next[0]?.provider ?? sttProvider,
      diarizationSupported,
      status: "completed",
    });
  }

  async function ensureMic(deviceId?: string | null) {
    if (micStream && micPhase === "granted") {
      if (
        !deviceId ||
        deviceId ===
          (micStream.getAudioTracks()[0]?.getSettings().deviceId ?? null)
      ) {
        return true;
      }
    }
    flushSync(() => setMicBusy(true));
    const ok = await startMic({ deviceId: deviceId ?? selectedDeviceId });
    setMicBusy(false);
    return ok;
  }

  async function previewMic() {
    if (recordingState !== "idle" || micBusy) return;
    await ensureMic(selectedDeviceId);
  }

  async function handleDeviceChange(deviceId: string) {
    setSelectedDeviceId(deviceId);
    if (recordingState !== "idle") return;
    if (micPhase === "granted" || micStream) {
      await ensureMic(deviceId);
    }
  }

  async function startRecording() {
    if (recordingState !== "idle" || micBusy) return;
    const ok = await ensureMic(selectedDeviceId);
    if (!ok) return;

    resetRecorder();
    recorderStartedRef.current = false;
    sessionIdRef.current = createId("session");
    lastChunkSavedAtRef.current = null;
    chunkPersistErrorRef.current = false;
    setLastChunkSavedAt(null);
    setAudioSaveError(null);
    setPendingAudio(null);
    setConsentOpen(false);
    setSeekToSec(null);

    await deleteMeetingAudioData(meetingId);
    setSavedAudio(null);
    setAudioRecovered(false);

    setReviewSegments([]);
    setShowReview(false);
    setSttError(null);
    setSttPending(false);
    setLlmError(null);
    setSummaryText(null);
    setDetailText(null);
    setDetailMinutes(null);
    setSummarySourceLabel(null);
    setGenerationSource("llm");
    void deleteMeetingTranscript(meetingId);
    void deleteMeetingGeneration(meetingId);
    void deleteGenerationVersionsByMeeting(meetingId);
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

  function requestStopRecording() {
    if (recordingState === "idle") return;
    setStopConfirmOpen(true);
  }

  async function confirmStopRecording() {
    setStopConfirmOpen(false);
    if (recordingState === "idle") return;

    if (recordingState === "recording" && startedAtRef.current !== null) {
      accumulatedRef.current += (Date.now() - startedAtRef.current) / 1000;
    }
    startedAtRef.current = null;
    setElapsedSec(accumulatedRef.current);

    const audio = await stopRecorder();
    recorderStartedRef.current = false;
    stopMic();
    setRecordingState("idle");

    const durationSec = Math.floor(accumulatedRef.current);
    void persist({ durationSec });

    if (!audio) {
      setAudioSaveError("녹음된 음성을 찾지 못했습니다.");
      void persist({ displayStatus: "복구 필요" });
      return;
    }

    const sessionId = sessionIdRef.current ?? createId("session");
    const pending = {
      blob: audio.blob,
      mimeType: audio.mimeType,
      sessionId,
      durationSec,
      lastChunkSavedAt: lastChunkSavedAtRef.current,
    };
    setPendingAudio(pending);

    const saved = await persistFinalAudio(pending);
    if (!saved) {
      // Keep pending for retry / download even if IndexedDB write failed.
      setConsentOpen(false);
      return;
    }

    if (settingsRef.current.askAiAfterRecording) {
      setConsentOpen(true);
    } else {
      setPendingAudio(null);
      void persist({ displayStatus: "검토 필요" }).then(() => {
        router.push(`/meetings/${meetingId}`);
      });
    }
  }

  async function retrySaveAudio() {
    if (!pendingAudio) return;
    const saved = await persistFinalAudio(pendingAudio);
    if (!saved) return;
    if (settingsRef.current.askAiAfterRecording) {
      setConsentOpen(true);
    } else {
      setPendingAudio(null);
      void persist({ displayStatus: "검토 필요" }).then(() => {
        router.push(`/meetings/${meetingId}`);
      });
    }
  }

  function downloadPendingOrSavedAudio() {
    const source = pendingAudio ?? savedAudio;
    if (!source) return;
    const url = URL.createObjectURL(source.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.slice(0, 40) || "meeting"}.${extensionForMime(source.mimeType)}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveAudioOnly() {
    setConsentOpen(false);
    setPendingAudio(null);
    setShowReview(false);
    void persist({ displayStatus: "검토 필요" }).then(() => {
      router.push(`/meetings/${meetingId}`);
    });
  }

  function handleGenerateAi() {
    setConsentOpen(false);
    const audio = pendingAudio ?? savedAudio;
    setPendingAudio(null);
    if (!audio) {
      setSttError("저장된 음성을 찾지 못했습니다.");
      return;
    }
    void transcribeRecording(audio);
  }

  async function previewSummaryWithVirtualData() {
    if (recordingState !== "idle" || previewBusy || sttPending) return;
    setPreviewBusy(true);
    setSummaryPending(true);
    setDetailPending(true);
    setSttError(null);
    setShowReview(true);

    try {
      const segments = VIRTUAL_TRANSCRIPT_SEGMENTS.map((segment) => ({
        ...segment,
        id: `${meetingId}-${segment.id}`,
      }));

      setReviewSegments(segments);
      setDiarizationSupported(true);
      await saveMeetingTranscript({
        meetingId,
        segments,
        provider: "mock",
        diarizationSupported: true,
        status: "completed",
      });

      await new Promise((resolve) => setTimeout(resolve, 350));

      const summary = VIRTUAL_SUMMARY_TEXT;
      setSummaryText(summary);
      setSummarySourceLabel("가상 데이터 미리보기");
      setGenerationSource("mock");
      setSummaryPending(false);

      await new Promise((resolve) => setTimeout(resolve, 350));

      const detail = buildVirtualDetailMinutes(meetingId);
      const detailBody = formatDetailMinutesText(detail);
      setDetailMinutes(detail);
      setDetailText(detailBody);
      const notes = await getNotesByMeeting(meetingId);
      const fingerprint = buildGenerationInputFingerprint({
        segments,
        notes,
      });
      await saveMeetingGeneration({
        meetingId,
        summaryText: summary,
        detailText: detailBody,
        detailMinutes: detail,
        inputFingerprint: fingerprint,
        source: "mock",
        preserveAsAiOriginal: true,
      });
      await createGenerationVersion({
        meetingId,
        kind: "ai_initial",
        summaryText: summary,
        detailText: detailBody,
        detailMinutes: detail,
        source: "mock",
      });
      await persist({
        summaryPreview:
          summary.split("\n").find((line) => line.trim()) ?? summary,
        displayStatus: "검토 필요",
      });
      router.push(`/meetings/${meetingId}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "미리보기에 실패했습니다. 페이지를 새로고침해 주세요.";
      setSttError(message);
    } finally {
      setSummaryPending(false);
      setDetailPending(false);
      setPreviewBusy(false);
    }
  }

  const recordingElapsedSec =
    recordingState === "recording" || recordingState === "paused"
      ? elapsedSec
      : null;

  function handleSeek(seconds: number) {
    if (!savedAudio && !pendingAudio) {
      return;
    }
    setSeekToSec(seconds);
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

  const playableBlob = savedAudio ?? pendingAudio;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="animate-fade mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            ← 목록
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
                  disabled={micBusy || sttPending || previewBusy || consentOpen}
                  className="btn btn-danger px-5 py-2.5"
                >
                  {micBusy ? "마이크 연결 중…" : "● 녹음 시작"}
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
                    onClick={requestStopRecording}
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
                    onClick={requestStopRecording}
                    className="btn btn-primary px-4 py-2.5"
                  >
                    녹음 종료
                  </button>
                </>
              )}
            </div>
          </div>

          {recordingState === "idle" && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 rounded-2xl bg-[var(--surface-raised)] px-4 py-3 ring-1 ring-[var(--border)] sm:flex-row sm:items-center">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-[var(--muted)]">
                  마이크
                  <select
                    className="field w-full text-sm text-[var(--foreground)]"
                    value={selectedDeviceId ?? ""}
                    onChange={(event) =>
                      void handleDeviceChange(event.target.value)
                    }
                    aria-label="마이크 선택"
                  >
                    {devices.length === 0 ? (
                      <option value="">기본 마이크</option>
                    ) : (
                      devices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-ghost shrink-0 px-3 py-2 text-sm"
                  onClick={() => void previewMic()}
                  disabled={micBusy || sttPending || previewBusy}
                >
                  {micPhase === "granted" ? "입력 재확인" : "입력 확인"}
                </button>
              </div>

              {micPhase === "granted" && (
                <div className="flex items-center gap-3 rounded-2xl bg-[var(--accent-soft)]/70 px-4 py-3 ring-1 ring-[var(--border)]">
                  <span className="shrink-0 text-xs font-medium text-[var(--muted)]">
                    입력
                  </span>
                  <AudioWaveform
                    levels={levels}
                    active
                    voiceActive={voiceActive}
                    className="min-w-0 flex-1 justify-center"
                  />
                </div>
              )}
            </div>
          )}

          {recordingState === "idle" && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 ring-1 ring-[var(--border)] sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  녹음 없이 요약·상세 화면 확인
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                  가상 전사 데이터로 요약과 상세 회의록 결과를 미리볼 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void previewSummaryWithVirtualData()}
                disabled={micBusy || sttPending || previewBusy || consentOpen}
                className="btn btn-accent shrink-0 px-4 py-2.5"
              >
                {previewBusy
                  ? "미리보기 준비 중…"
                  : "가상 데이터로 미리보기"}
              </button>
            </div>
          )}

          {(recordingState === "recording" || recordingState === "paused") && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--danger-soft)]/60 px-4 py-3 ring-1 ring-[var(--border)]">
              <span className="shrink-0 text-xs font-medium text-[var(--muted)]">
                입력
              </span>
              <AudioWaveform
                levels={levels}
                active={recordingState === "recording"}
                voiceActive={voiceActive}
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

          {lastChunkSavedAt &&
            (recordingState === "recording" || recordingState === "paused") && (
              <p className="mt-3 text-xs text-[var(--muted)]">
                마지막 조각 저장 ·{" "}
                {new Date(lastChunkSavedAt).toLocaleTimeString("ko-KR")}
              </p>
            )}

          <p className="mt-3 text-xs text-[var(--muted)]">
            선택한 마이크로 입력되는 소리만 녹음됩니다
            {recordingState === "idle"
              ? " · 녹음 종료 후 AI 처리 여부를 확인합니다"
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

          {audioSaveError && (
            <div
              className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-4 py-3 ring-1 ring-[var(--border)]"
              role="alert"
            >
              <p className="text-sm font-semibold text-[var(--danger)]">
                ! 음성을 저장하지 못했습니다.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                {audioSaveError}
                {lastChunkSavedAt
                  ? ` 마지막 저장: ${new Date(lastChunkSavedAt).toLocaleTimeString("ko-KR")}`
                  : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingAudio && (
                  <button
                    type="button"
                    className="btn btn-primary px-3 py-1.5 text-sm"
                    onClick={() => void retrySaveAudio()}
                  >
                    다시 시도
                  </button>
                )}
                {(pendingAudio || savedAudio) && (
                  <button
                    type="button"
                    className="btn btn-ghost px-3 py-1.5 text-sm"
                    onClick={downloadPendingOrSavedAudio}
                  >
                    녹음 종료 후 파일 다운로드
                  </button>
                )}
              </div>
            </div>
          )}

          {audioRecovered && savedAudio && recordingState === "idle" && (
            <p className="mt-2 text-sm text-[var(--warning)]" role="status">
              비정상 종료 전 저장된 음성 조각을 복구했습니다. 재생·다운로드 후
              AI 생성을 이어갈 수 있습니다.
            </p>
          )}
        </div>
      </div>

      {playableBlob && recordingState === "idle" && (
        <div className="animate-rise mb-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              원본 음성
            </h2>
            {!showReview && !sttPending && !processingActive && (
              <button
                type="button"
                className="btn btn-ghost px-3 py-1.5 text-sm"
                onClick={() => setConsentOpen(true)}
              >
                AI 회의록 생성
              </button>
            )}
          </div>
          <AudioPlayer
            blob={playableBlob.blob}
            mimeType={playableBlob.mimeType}
            fileName={title.slice(0, 40) || "meeting"}
            seekToSec={seekToSec}
            onSeekHandled={() => setSeekToSec(null)}
          />
        </div>
      )}

      <div
        className="animate-rise grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]"
        style={{ animationDelay: "80ms" }}
      >
        <div className="flex min-w-0 flex-col gap-6">
          {processingActive && recordingState === "idle" && (
            <AiProcessingPanel
              steps={processingSteps}
              sttProvider={sttProvider}
              llmProvider={llmProvider}
              totalElapsedMs={processingTickMs}
              onRetryStep={(stepId) => void handleRetryStep(stepId)}
              onViewResults={() => {
                setProcessingActive(false);
                setShowReview(true);
                router.push(`/meetings/${meetingId}`);
              }}
            />
          )}

          {showReview && recordingState === "idle" && !processingActive && (
            <section className="glass-panel rounded-[var(--radius)] p-5 sm:p-6">
              {llmError && (
                <p
                  className="mb-3 rounded-xl bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]"
                  role="alert"
                >
                  {llmError}
                </p>
              )}
              <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
                회의록 검토
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                전사문 · 요약 · 상세 · 확정 · 근거 확인은 검토 화면에서
                진행합니다.
                {summarySourceLabel ? ` · ${summarySourceLabel}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/meetings/${meetingId}`}
                  className="btn btn-primary px-4 py-2 text-sm"
                >
                  회의록 검토하기
                </Link>
                {(summaryText || detailMinutes) && (
                  <button
                    type="button"
                    className="btn btn-ghost px-3 py-2 text-sm"
                    onClick={() => {
                      const text = buildFullText(reviewSegments);
                      if (!text.trim()) return;
                      setProcessingActive(true);
                      setProcessingSteps((prev) =>
                        patchStep(
                          patchStep(prev, "generate_summary", {
                            status: "pending",
                            error: undefined,
                          }),
                          "complete",
                          { status: "pending" },
                        ),
                      );
                      if (processingStartedAt == null) {
                        setProcessingStartedAt(Date.now());
                      }
                      void generateWithLlm(text, "both");
                    }}
                  >
                    AI 다시 생성
                  </button>
                )}
              </div>
            </section>
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
                <dt className="text-xs text-[var(--muted)]">LLM 엔진</dt>
                <dd className="mt-1 text-base font-medium">
                  {llmConfigured
                    ? llmProviderLabel(llmProvider)
                    : `${llmProviderLabel(llmProvider)} (미연결)`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">저장</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  음성 조각·메모는 이 브라우저 IndexedDB에 저장됩니다
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={stopConfirmOpen}
        title="회의 녹음을 종료하시겠습니까?"
        description={`현재 녹음: ${formatTimestamp(elapsedSec)}\n\n녹음을 종료하면 음성 파일을 저장합니다.`}
        confirmLabel="녹음 종료"
        onCancel={() => setStopConfirmOpen(false)}
        onConfirm={() => void confirmStopRecording()}
      />

      <AiConsentDialog
        open={consentOpen}
        sttProvider={sttProvider}
        llmProvider={llmProvider}
        llmConfigured={llmConfigured}
        onCancel={() => setConsentOpen(false)}
        onSaveAudioOnly={handleSaveAudioOnly}
        onGenerateAi={handleGenerateAi}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
