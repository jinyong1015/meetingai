"use client";

import type { SaveStatus } from "@/lib/types/note";

type SaveIndicatorProps = {
  status: SaveStatus;
  lastSavedAt: Date | null;
  onRetry?: () => void;
};

export function SaveIndicator({
  status,
  lastSavedAt,
  onRetry,
}: SaveIndicatorProps) {
  const timeLabel =
    lastSavedAt &&
    lastSavedAt.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  if (status === "saving") {
    return (
      <p
        className="inline-flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-1 text-xs font-medium text-[var(--muted)] ring-1 ring-[var(--border)]"
        aria-live="polite"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-[var(--muted)]" />
        저장 중
      </p>
    );
  }

  if (status === "saved") {
    return (
      <p
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--success-soft)] px-2.5 py-1 text-xs font-medium text-[var(--success)]"
        aria-live="polite"
      >
        저장됨{timeLabel ? ` · ${timeLabel}` : ""}
      </p>
    );
  }

  if (status === "error") {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--danger-soft)] px-2.5 py-1"
        role="alert"
      >
        <p className="text-xs font-medium text-[var(--danger)]">저장 실패</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold text-[var(--danger)] underline-offset-2 hover:underline"
          >
            다시 시도
          </button>
        )}
      </div>
    );
  }

  return (
    <p
      className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--muted)]"
      aria-live="polite"
    >
      자동 저장
    </p>
  );
}
