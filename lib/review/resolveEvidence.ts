import type { EvidenceRef, ResolvedEvidence } from "@/lib/types/evidence";
import type { Note } from "@/lib/types/note";
import type { TranscriptSegment } from "@/lib/types/transcript";

export function resolveEvidence(input: {
  ref: EvidenceRef | null | undefined;
  segments: TranscriptSegment[];
  notes: Note[];
}): ResolvedEvidence | null {
  const ref = input.ref;
  if (!ref) return null;

  if (ref.kind === "note") {
    const note = ref.noteId
      ? input.notes.find((item) => item.id === ref.noteId)
      : undefined;
    if (!note) {
      return {
        ref,
        valid: false,
        error: "연결된 메모를 찾을 수 없습니다. 근거 확인이 필요합니다.",
        text: "",
        startTimeSec: ref.startTimeSec ?? null,
        endTimeSec: ref.endTimeSec ?? null,
      };
    }
    return {
      ref,
      valid: true,
      text: note.content,
      noteImportant: note.important,
      noteIncludeInAI: note.includeInAI,
      startTimeSec: note.timestampSec ?? ref.startTimeSec ?? null,
      endTimeSec: ref.endTimeSec ?? null,
    };
  }

  const segment = ref.segmentId
    ? input.segments.find((item) => item.id === ref.segmentId)
    : undefined;

  if (!segment) {
    return {
      ref,
      valid: false,
      error: "연결된 전사 구간을 찾을 수 없습니다. 근거 확인이 필요합니다.",
      text: "",
      startTimeSec: ref.startTimeSec ?? null,
      endTimeSec: ref.endTimeSec ?? null,
    };
  }

  return {
    ref,
    valid: true,
    speakerLabel: segment.speakerLabel ?? null,
    text: segment.text,
    startTimeSec: ref.startTimeSec ?? segment.startedAtSec,
    endTimeSec: ref.endTimeSec ?? segment.endedAtSec ?? null,
  };
}

/** Clip end: endTime + 3s, capped by audio duration when known. */
export function evidenceStopAtSec(
  endTimeSec: number | null | undefined,
  audioDurationSec: number | null | undefined,
): number | null {
  if (endTimeSec == null || !Number.isFinite(endTimeSec)) return null;
  const stop = endTimeSec + 3;
  if (audioDurationSec != null && Number.isFinite(audioDurationSec) && audioDurationSec > 0) {
    return Math.min(stop, audioDurationSec);
  }
  return stop;
}
