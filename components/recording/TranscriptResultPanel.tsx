"use client";

import type { TranscriptSegment } from "@/lib/types/transcript";
import { formatTimestamp } from "@/lib/utils/format-time";

type TranscriptResultPanelProps = {
  segments: TranscriptSegment[];
  providerLabel: string;
  /** Still waiting for the last STT chunk after stop. */
  pending?: boolean;
  error?: string | null;
  /** When true, omit outer glass panel (used inside result tabs). */
  embedded?: boolean;
  diarizationSupported?: boolean;
  onSpeakerChange?: (segmentId: string, speakerLabel: string) => void;
  onSeekSegment?: (startedAtSec: number) => void;
};

export function TranscriptResultPanel({
  segments,
  providerLabel,
  pending = false,
  error = null,
  embedded = false,
  diarizationSupported = false,
  onSpeakerChange,
  onSeekSegment,
}: TranscriptResultPanelProps) {
  const fullText = segments
    .map((segment) => {
      const speaker = segment.speakerLabel?.trim();
      const body = segment.text.trim();
      if (!body) return "";
      return speaker ? `${speaker}: ${body}` : body;
    })
    .filter(Boolean)
    .join("\n");

  const body = (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            className={`font-[family-name:var(--font-display)] font-bold tracking-tight ${
              embedded ? "text-base" : "text-lg"
            }`}
          >
            {embedded ? "전사문" : "음성 인식 결과"}
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            녹음이 끝난 뒤 저장된 전사입니다 · {providerLabel}
            {diarizationSupported
              ? " · 화자 구분 지원"
              : " · 화자 구분 미지원(단일 화자)"}
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="font-[family-name:var(--font-mono)] text-xs text-[var(--accent)] underline-offset-2 hover:underline"
                  onClick={() => onSeekSegment?.(segment.startedAtSec)}
                  title="이 시점으로 이동"
                >
                  {formatTimestamp(segment.startedAtSec)}
                  {segment.endedAtSec != null
                    ? `–${formatTimestamp(segment.endedAtSec)}`
                    : ""}
                </button>
                {onSpeakerChange ? (
                  <input
                    type="text"
                    aria-label="화자 이름"
                    className="min-w-[5.5rem] rounded-md bg-white/70 px-2 py-0.5 text-xs font-medium outline-none ring-1 ring-[var(--border)]"
                    value={segment.speakerLabel ?? "화자 A"}
                    onChange={(event) =>
                      onSpeakerChange(segment.id, event.target.value)
                    }
                  />
                ) : (
                  <span className="text-xs font-medium text-[var(--muted)]">
                    {segment.speakerLabel ?? "화자 A"}
                  </span>
                )}
              </div>
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
    </>
  );

  if (embedded) {
    return <div aria-label="전사문">{body}</div>;
  }

  return (
    <section
      className="glass-panel rounded-[var(--radius)] p-5 sm:p-6"
      aria-label="음성 인식 결과"
    >
      {body}
    </section>
  );
}
