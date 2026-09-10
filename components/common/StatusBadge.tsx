import type { MeetingDisplayStatus } from "@/lib/types/meeting";

const STATUS_STYLES: Record<
  MeetingDisplayStatus,
  { wrap: string; dot: string }
> = {
  준비: {
    wrap: "bg-white/70 text-[var(--muted)] ring-[var(--border)]",
    dot: "bg-[var(--muted)]",
  },
  "녹음 중": {
    wrap: "bg-[var(--danger-soft)] text-[var(--danger)] ring-transparent",
    dot: "bg-[var(--danger)] animate-pulse-dot",
  },
  "저장 중": {
    wrap: "bg-white/70 text-[var(--muted)] ring-[var(--border)]",
    dot: "bg-[var(--muted)]",
  },
  "AI 처리 중": {
    wrap: "bg-[var(--accent-soft)] text-[var(--accent)] ring-transparent",
    dot: "bg-[var(--accent)]",
  },
  "검토 필요": {
    wrap: "bg-[var(--warning-soft)] text-[var(--warning)] ring-transparent",
    dot: "bg-[var(--warning)]",
  },
  확정됨: {
    wrap: "bg-[var(--success-soft)] text-[var(--success)] ring-transparent",
    dot: "bg-[var(--success)]",
  },
  "전송 완료": {
    wrap: "bg-[var(--success-soft)] text-[var(--success)] ring-transparent",
    dot: "bg-[var(--success)]",
  },
  "처리 실패": {
    wrap: "bg-[var(--danger-soft)] text-[var(--danger)] ring-transparent",
    dot: "bg-[var(--danger)]",
  },
  "전송 실패": {
    wrap: "bg-[var(--danger-soft)] text-[var(--danger)] ring-transparent",
    dot: "bg-[var(--danger)]",
  },
  "복구 필요": {
    wrap: "bg-[var(--danger-soft)] text-[var(--danger)] ring-transparent",
    dot: "bg-[var(--danger)]",
  },
};

type StatusBadgeProps = {
  status: MeetingDisplayStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${style.wrap}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden />
      {status}
    </span>
  );
}
