import type { SttProvider, SttSegmentResult } from "@/lib/stt/types";
import type { TranscriptSegment } from "@/lib/types/transcript";

export function mapSttSegmentsToTranscript(
  meetingId: string,
  provider: SttProvider | string,
  segments: SttSegmentResult[],
): TranscriptSegment[] {
  return segments.map((segment, index) => ({
    id: segment.id || `${meetingId}-seg-${index}`,
    text: segment.text,
    startedAtSec: segment.startedAtSec,
    endedAtSec: segment.endedAtSec,
    speakerLabel: segment.speakerLabel ?? "화자 A",
    originalSpeakerLabel: segment.originalSpeakerLabel ?? null,
    provider,
  }));
}
