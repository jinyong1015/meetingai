import type { SttProvider } from "@/lib/stt/types";

export type TranscriptSegment = {
  id: string;
  text: string;
  /** Recording timeline seconds when the chunk started. */
  startedAtSec: number;
  /** Recording timeline seconds when the chunk ended (if known). */
  endedAtSec?: number;
  /**
   * Display speaker label (e.g. "화자 A"). Editable by the user.
   * Null when the engine did not provide speaker info.
   */
  speakerLabel?: string | null;
  /** Original engine speaker id/label before user rename. */
  originalSpeakerLabel?: string | null;
  provider?: SttProvider | string;
};

export type TranscriptJobStatus = "pending" | "completed" | "error";

/** One transcript document per meeting (replaced when a new recording starts). */
export type MeetingTranscript = {
  meetingId: string;
  segments: TranscriptSegment[];
  provider: SttProvider | string;
  fullText: string;
  updatedAt: string;
  model?: string;
  /** True when the engine returned distinct speakers. */
  diarizationSupported?: boolean;
  /** AssemblyAI (or similar) remote job id for AI-05 re-query. */
  remoteJobId?: string | null;
  status?: TranscriptJobStatus;
};

export function buildFullText(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => {
      const speaker = segment.speakerLabel?.trim();
      const body = segment.text.trim();
      if (!body) return "";
      return speaker ? `${speaker}: ${body}` : body;
    })
    .filter(Boolean)
    .join("\n");
}

/** Map engine speaker ids (A/B/1/SPEAKER_00) to stable Korean labels. */
export function speakerLabelFromEngine(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "화자 A";
  const value = String(raw).trim();
  const letter = value.match(/(?:SPEAKER[_-]?|화자\s*)?([A-Z])$/i)?.[1];
  if (letter) return `화자 ${letter.toUpperCase()}`;
  const num = value.match(/(\d+)/)?.[1];
  if (num != null) {
    const index = Number(num);
    if (Number.isFinite(index)) {
      const code = String.fromCharCode(65 + (index % 26));
      return `화자 ${code}`;
    }
  }
  return `화자 ${value}`;
}
