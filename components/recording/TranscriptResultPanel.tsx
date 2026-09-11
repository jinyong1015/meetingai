"use client";

import type { TranscriptSegment } from "@/lib/types/transcript";
import { formatTimestamp } from "@/lib/utils/format-time";

type TranscriptResultPanelProps = {
  segments: TranscriptSegment[];
  providerLabel: string;
  /** Still waiting for the last STT chunk after stop. */
  pending?: boolean;
  error?: string | null;
};

export function TranscriptResultPanel({
  segments,
  providerLabel,
  pending = false,
  error = null,
}: TranscriptResultPanelProps) {
  const fullText = segments.map((segment) => segment.text).join("\n");

  return (
    <section
      className="glass-panel rounded-[var(--radius)] p-5 sm:p-6"
      aria-label="음성 인식 결과"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
            음성 인식 결과
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            녹음이 끝난 뒤 저장된 전사입니다 · {providerLabel}
          </p>
        </div>
        <span className="rounded-lg bg-white/60 px-2.5 py-1 text-xs font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
          {pending ? "마지막 구간 변환 중…" : `${segments.length}개 구간`}
        </span>
      </div>

      {segments.length === 0 && !pending && !error ? (
        <p className="text-sm text-[var(--muted)]">
          인식된 텍스트가 없습니다. 다시 녹음해 보세요.
        </p>
      ) : (
        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className="rounded-xl bg-white/55 px-3 py-2.5 ring-1 ring-[var(--border)]"
            >
              <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                {formatTimestamp(segment.startedAtSec)}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{segment.text}</p>
            </div>
          ))}
          {pending && (
            <p className="text-sm text-[var(--accent)]" role="status">
              마지막 음성을 텍스트로 변환하는 중…
            </p>
          )}
        </div>
      )}

      {fullText && (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            전체 텍스트
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{fullText}</p>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
