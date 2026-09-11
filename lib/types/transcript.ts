import type { SttProvider } from "@/lib/stt/types";

export type TranscriptSegment = {
  id: string;
  text: string;
  /** Recording timeline seconds when the chunk started. */
  startedAtSec: number;
  provider?: SttProvider | string;
};

/** One transcript document per meeting (replaced when a new recording starts). */
export type MeetingTranscript = {
  meetingId: string;
  segments: TranscriptSegment[];
  provider: SttProvider | string;
  fullText: string;
  updatedAt: string;
};

export function buildFullText(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join("\n");
}
