import type { Note } from "@/lib/types/note";
import type { TranscriptSegment } from "@/lib/types/transcript";

/** Snapshot of generation inputs used to detect stale AI results (AI-10). */
export function buildGenerationInputFingerprint(input: {
  segments: TranscriptSegment[];
  notes: Note[];
}): string {
  const transcriptPart = input.segments
    .map((segment) =>
      [
        segment.id,
        segment.speakerLabel ?? "",
        segment.text.trim(),
        String(segment.startedAtSec),
        String(segment.endedAtSec ?? ""),
      ].join("|"),
    )
    .join("\n");

  const notesPart = input.notes
    .filter((note) => note.includeInAI)
    .map((note) =>
      [
        note.id,
        note.content.trim(),
        note.important ? "1" : "0",
        String(note.timestampSec ?? ""),
      ].join("|"),
    )
    .sort()
    .join("\n");

  return `${transcriptPart}\n---\n${notesPart}`;
}
