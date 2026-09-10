"use client";

import type { KeyboardEvent } from "react";
import { formatTimestamp } from "@/lib/utils/format-time";

type NoteEditorProps = {
  value: string;
  important: boolean;
  includeInAI: boolean;
  remainingChars: number;
  limitMessage: string | null;
  recordingElapsedSec: number | null;
  onChange: (value: string) => void;
  onImportantChange: (value: boolean) => void;
  onIncludeInAIChange: (value: boolean) => void;
  onSubmit: () => void;
};

export function NoteEditor({
  value,
  important,
  includeInAI,
  remainingChars,
  limitMessage,
  recordingElapsedSec,
  onChange,
  onImportantChange,
  onIncludeInAIChange,
  onSubmit,
}: NoteEditorProps) {
  const canSubmit = value.trim().length > 0 && remainingChars >= 0;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canSubmit) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="rounded-2xl bg-[var(--surface-solid)] p-4 ring-1 ring-[var(--border)] transition-[box-shadow] focus-within:ring-[var(--border-strong)] focus-within:shadow-[0_0_0_4px_var(--accent-soft)]">
      {recordingElapsedSec !== null && (
        <p className="mb-3 inline-flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs font-medium text-[var(--accent)]">
          <span className="size-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
          [{formatTimestamp(recordingElapsedSec)}]에 저장
        </p>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="떠오른 맥락, 확인할 사항, 중요한 발언을 적어 주세요"
        rows={3}
        className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none"
        aria-label="새 메모 입력"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onImportantChange(!important)}
            aria-pressed={important}
            className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
              important
                ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]"
            }`}
          >
            {important ? "중요" : "중요 표시"}
          </button>

          <button
            type="button"
            onClick={() => onIncludeInAIChange(!includeInAI)}
            aria-pressed={includeInAI}
            className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
              includeInAI
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]"
            }`}
          >
            {includeInAI ? "AI 반영 켜짐" : "AI 반영 꺼짐"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`font-[family-name:var(--font-mono)] text-xs tabular-nums ${
              remainingChars < 500 ? "text-[var(--danger)]" : "text-[var(--muted)]"
            }`}
          >
            {remainingChars.toLocaleString("ko-KR")}
          </span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="btn btn-primary px-4 py-2"
          >
            추가
          </button>
        </div>
      </div>

      {limitMessage && (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {limitMessage}
        </p>
      )}

      <p className="mt-2 text-xs text-[var(--muted)]">
        Ctrl/⌘ + Enter · 입력 중단 후 자동 저장
      </p>
    </div>
  );
}
