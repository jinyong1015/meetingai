import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";

export type AiProcessingStepId =
  | "save_audio"
  | "upload_audio"
  | "transcribe"
  | "generate_summary"
  | "generate_minutes"
  | "complete";

export type AiProcessingStepStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export type AiProcessingStep = {
  id: AiProcessingStepId;
  label: string;
  status: AiProcessingStepStatus;
  /** Elapsed ms while this step was running (accumulated). */
  elapsedMs: number;
  detail?: string;
  error?: string;
};

export type AiProcessingState = {
  steps: AiProcessingStep[];
  sttProvider: SttProvider;
  llmProvider: LlmProvider;
  startedAt: number | null;
  active: boolean;
};

export function uploadStepLabel(sttProvider: SttProvider): string {
  return sttProvider === "whisper" ? "로컬 입력 준비" : "음성 업로드";
}

export function createInitialProcessingSteps(
  sttProvider: SttProvider,
): AiProcessingStep[] {
  return [
    {
      id: "save_audio",
      label: "음성 저장",
      status: "success",
      elapsedMs: 0,
      detail: "로컬에 저장됨",
    },
    {
      id: "upload_audio",
      label: uploadStepLabel(sttProvider),
      status: "pending",
      elapsedMs: 0,
    },
    {
      id: "transcribe",
      label: "전사",
      status: "pending",
      elapsedMs: 0,
    },
    {
      id: "generate_summary",
      label: "요약 생성",
      status: "pending",
      elapsedMs: 0,
    },
    {
      id: "generate_minutes",
      label: "상세 회의록",
      status: "pending",
      elapsedMs: 0,
    },
    {
      id: "complete",
      label: "완료",
      status: "pending",
      elapsedMs: 0,
    },
  ];
}

export function patchStep(
  steps: AiProcessingStep[],
  id: AiProcessingStepId,
  patch: Partial<AiProcessingStep>,
): AiProcessingStep[] {
  return steps.map((step) => (step.id === id ? { ...step, ...patch } : step));
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
