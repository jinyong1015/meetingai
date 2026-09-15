"use client";

import { AudioPlayer } from "@/components/recording/AudioPlayer";
import type { ResolvedEvidence } from "@/lib/types/evidence";
import { evidenceStopAtSec } from "@/lib/review/resolveEvidence";
import { formatTimestamp } from "@/lib/utils/format-time";

type EvidencePanelProps = {
  evidence: ResolvedEvidence;
  audioBlob: Blob | null;
  audioMimeType: string;
  audioDurationSec?: number | null;
  fileName?: string;
  onClose: () => void;
  onViewInTranscript?: () => void;
};

export function EvidencePanel({
  evidence,
  audioBlob,
  audioMimeType,
  audioDurationSec = null,
  fileName = "meeting-audio",
  onClose,
  onViewInTranscript,
}: EvidencePanelProps) {
  const start = evidence.startTimeSec;
  const stopAt =
    evidence.valid && start != null
      ? evidenceStopAtSec(evidence.endTimeSec, audioDurationSec)
      : null;
  const canSeekAudio =
    evidence.valid &&
    audioBlob != null &&
    start != null &&
    Number.isFinite(start) &&
    start >= 0 &&
    (audioDurationSec == null || start <= audioDurationSec);

  const isNote = evidence.ref.kind === "note";

  return (
    <aside
      className="rounded-[var(--radius)] bg-white/70 p-4 ring-1 ring-[var(--border)] sm:p-5"
      aria-label="근거 발언"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
            {isNote ? "사용자 메모" : "근거 발언"}
          </h3>
          {start != null && (
            <p className="mt-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--muted)]">
              {formatTimestamp(start)}
              {evidence.endTimeSec != null
                ? ` – ${formatTimestamp(evidence.endTimeSec)}`
                : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost px-2.5 py-1.5 text-xs"
          onClick={onClose}
        >
          닫기
        </button>
      </div>

      {!evidence.valid ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {evidence.error ?? "근거 확인이 필요합니다."}
        </p>
      ) : (
        <>
          {!isNote && evidence.speakerLabel && (
            <p className="mb-2 text-sm font-semibold text-[var(--accent)]">
              {evidence.speakerLabel}
            </p>
          )}
          {isNote && (
            <p className="mb-2 text-xs text-[var(--muted)]">
              {evidence.noteImportant ? "중요 · " : ""}
              {evidence.noteIncludeInAI ? "AI 반영" : "AI 미반영"}
            </p>
          )}
          <p className="text-sm leading-relaxed text-[var(--foreground)]">
            “{evidence.text}”
          </p>

          {canSeekAudio && audioBlob ? (
            <div className="mt-4">
              <AudioPlayer
                blob={audioBlob}
                mimeType={audioMimeType}
                fileName={fileName}
                seekToSec={start}
                stopAtSec={stopAt}
              />
            </div>
          ) : isNote && start == null ? (
            <p className="mt-3 text-xs text-[var(--muted)]">
              이 메모에는 녹음 시점이 없어 오디오 이동을 제공하지 않습니다.
            </p>
          ) : !audioBlob ? (
            <p className="mt-3 text-xs text-[var(--danger)]" role="alert">
              원본 음성을 찾을 수 없습니다. 확인 가능한 원문만 표시합니다.
            </p>
          ) : start != null &&
            audioDurationSec != null &&
            start > audioDurationSec ? (
            <p className="mt-3 text-xs text-[var(--danger)]" role="alert">
              근거 시점이 음성 길이를 벗어납니다. 원문은 확인할 수 있습니다.
            </p>
          ) : null}

          {!isNote && onViewInTranscript && evidence.valid && (
            <button
              type="button"
              className="btn btn-ghost mt-3 px-3 py-1.5 text-sm"
              onClick={onViewInTranscript}
            >
              전사문에서 보기
            </button>
          )}
        </>
      )}
    </aside>
  );
}
