"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { Meeting } from "@/lib/types/meeting";
import {
  formatDurationMinutes,
  formatMeetingDateTime,
} from "@/lib/utils/format-time";

type MeetingCardProps = {
  meeting: Meeting;
  onDelete: (meeting: Meeting) => void;
  onExport: (meeting: Meeting) => void;
};

export function MeetingCard({ meeting, onDelete, onExport }: MeetingCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const summary =
    meeting.summaryPreview?.trim() ||
    "AI 회의록이 아직 생성되지 않았습니다.";

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <article className="glass-panel relative rounded-[var(--radius)] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Link
          href={`/meetings/${meeting.id}/record`}
          className="min-w-0 flex-1"
        >
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
            {meeting.title}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {formatMeetingDateTime(meeting.startedAt)} ·{" "}
            {formatDurationMinutes(meeting.durationSec)}
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--foreground)]">
            {summary}
          </p>
        </Link>
        <div className="relative flex shrink-0 items-center gap-1.5" ref={menuRef}>
          <StatusBadge status={meeting.displayStatus} />
          <button
            type="button"
            className="btn btn-ghost size-9 p-0 text-lg leading-none"
            aria-label="더보기"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ⋮
          </button>
          {menuOpen && (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 top-11 z-10 min-w-36 overflow-hidden rounded-xl bg-white py-1 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-raised)]"
                onClick={() => {
                  setMenuOpen(false);
                  onExport(meeting);
                }}
              >
                내보내기
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(meeting);
                }}
              >
                삭제
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
