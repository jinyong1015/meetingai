"use client";

import type { Note } from "@/lib/types/note";
import { formatTimestamp } from "@/lib/utils/format-time";

type NoteItemProps = {
  note: Note;
  onContentChange: (noteId: string, content: string) => void;
  onToggleImportant: (noteId: string) => void;
  onToggleIncludeInAI: (noteId: string) => void;
  onDelete: (noteId: string) => void;
  onSeekTimestamp?: (seconds: number) => void;
};

export function NoteItem({
  note,
  onContentChange,
  onToggleImportant,
  onToggleIncludeInAI,
  onDelete,
  onSeekTimestamp,
}: NoteItemProps) {
  const hasTimestamp = note.timestampSec !== null;

  return (
    <article className="group relative rounded-2xl bg-white/60 p-4 ring-1 ring-[var(--border)] transition-colors hover:bg-white hover:ring-[var(--border-strong)]">
      <div className="mb-2 flex items-center justify-between gap-3">
        {hasTimestamp ? (
          <button
            type="button"
            onClick={() => onSeekTimestamp?.(note.timestampSec!)}
            className="rounded-lg bg-[var(--accent-soft)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs font-semibold text-[var(--accent)] transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            title="이 시점의 음성으로 이동"
            aria-label={`${formatTimestamp(note.timestampSec!)} 시점으로 이동`}
          >
            {formatTimestamp(note.timestampSec!)}
          </button>
        ) : (
          <span className="text-xs font-medium text-[var(--muted)]">시점 없음</span>
        )}

        <button
          type="button"
          onClick={() => onDelete(note.id)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] opacity-0 transition-all hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="메모 삭제"
        >
          삭제
        </button>
      </div>

      <textarea
        value={note.content}
        onChange={(e) => onContentChange(note.id, e.target.value)}
        rows={Math.min(8, Math.max(2, note.content.split("\n").length + 1))}
        className="w-full resize-y bg-transparent text-[15px] leading-relaxed text-[var(--foreground)] outline-none"
        aria-label="메모 내용"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleImportant(note.id)}
          aria-pressed={note.important}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
            note.important
              ? "bg-[var(--warning-soft)] text-[var(--warning)]"
              : "text-[var(--muted)] hover:bg-[var(--surface-raised)]"
          }`}
        >
          {note.important ? "중요" : "중요 표시"}
        </button>

        <button
          type="button"
          onClick={() => onToggleIncludeInAI(note.id)}
          aria-pressed={note.includeInAI}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
            note.includeInAI
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "text-[var(--muted)] hover:bg-[var(--surface-raised)]"
          }`}
        >
          {note.includeInAI ? "AI 반영" : "AI 제외"}
        </button>
      </div>
    </article>
  );
}
