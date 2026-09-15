"use client";

import {
  formatElapsed,
  type AiProcessingStep,
  type AiProcessingStepId,
} from "@/lib/ai/processing";
import { llmProviderLabel, sttProviderLabel } from "@/lib/types/settings";
import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";

type AiProcessingPanelProps = {
  steps: AiProcessingStep[];
  sttProvider: SttProvider;
  llmProvider: LlmProvider;
  totalElapsedMs: number;
  onRetryStep?: (stepId: AiProcessingStepId) => void;
  onViewResults?: () => void;
};

function statusLabel(status: AiProcessingStep["status"]): string {
  if (status === "running") return "처리 중";
  if (status === "success") return "완료";
  if (status === "failed") return "실패";
  if (status === "skipped") return "건너뜀";
  return "대기";
}

function statusClass(status: AiProcessingStep["status"]): string {
  if (status === "running") return "text-[var(--accent)]";
  if (status === "success") return "text-[var(--foreground)]";
  if (status === "failed") return "text-[var(--danger)]";
  return "text-[var(--muted)]";
}

function canRetry(id: AiProcessingStepId): boolean {
  return (
    id === "transcribe" ||
    id === "generate_summary" ||
    id === "generate_minutes"
  );
}

export function AiProcessingPanel({
  steps,
  sttProvider,
  llmProvider,
  totalElapsedMs,
  onRetryStep,
  onViewResults,
}: AiProcessingPanelProps) {
  const visible = steps.filter((step) => step.id !== "complete");
  const complete = steps.find((step) => step.id === "complete");
  const failed = steps.find((step) => step.status === "failed");
  const done = complete?.status === "success";

  return (
    <section
      className="glass-panel rounded-[var(--radius)] p-5 sm:p-6"
      aria-label="AI 처리 진행"
      aria-live="polite"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
            {done
              ? "회의록 생성이 완료되었습니다"
              : failed
                ? "회의록 생성 중 오류가 발생했습니다"
                : "회의록을 생성하고 있습니다"}
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            STT {sttProviderLabel(sttProvider)} · LLM{" "}
            {llmProviderLabel(llmProvider)} · 경과{" "}
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {formatElapsed(totalElapsedMs)}
            </span>
          </p>
        </div>
        {done && onViewResults && (
          <button
            type="button"
            className="btn btn-primary px-3 py-1.5 text-sm"
            onClick={onViewResults}
          >
            회의록 검토하기
          </button>
        )}
      </div>

      <ol className="space-y-3">
        {visible.map((step, index) => (
          <li
            key={step.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/55 px-3 py-2.5 ring-1 ring-[var(--border)]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <span className="mr-2 text-[var(--muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step.label}
              </p>
              <p className={`mt-0.5 text-xs ${statusClass(step.status)}`}>
                {statusLabel(step.status)}
                {step.status === "running" || step.elapsedMs > 0
                  ? ` · 경과 ${formatElapsed(step.elapsedMs)}`
                  : ""}
                {step.detail ? ` · ${step.detail}` : ""}
                {step.error ? ` · ${step.error}` : ""}
              </p>
            </div>
            {step.status === "failed" &&
              canRetry(step.id) &&
              onRetryStep && (
                <button
                  type="button"
                  className="btn btn-ghost px-3 py-1.5 text-sm"
                  onClick={() => onRetryStep(step.id)}
                >
                  다시 시도
                </button>
              )}
          </li>
        ))}
      </ol>

      {failed && (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
          실패 단계만 다시 시도할 수 있습니다. 이미 성공한 요약·상세는 유지됩니다.
        </p>
      )}
    </section>
  );
}
