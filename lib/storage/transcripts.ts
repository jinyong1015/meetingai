import { openDb, requestToPromise, TRANSCRIPTS_STORE } from "@/lib/storage/db";
import type { SttProvider } from "@/lib/stt/types";
import {
  buildFullText,
  type MeetingTranscript,
  type TranscriptSegment,
} from "@/lib/types/transcript";

export async function getMeetingTranscript(
  meetingId: string,
): Promise<MeetingTranscript | undefined> {
  const db = await openDb();
  try {
    const tx = db.transaction(TRANSCRIPTS_STORE, "readonly");
    const row = await requestToPromise(
      tx.objectStore(TRANSCRIPTS_STORE).get(meetingId),
    );
    return row as MeetingTranscript | undefined;
  } finally {
    db.close();
  }
}

export async function saveMeetingTranscript(input: {
  meetingId: string;
  segments: TranscriptSegment[];
  provider: SttProvider | string;
}): Promise<MeetingTranscript> {
  const next: MeetingTranscript = {
    meetingId: input.meetingId,
    segments: input.segments,
    provider: input.provider,
    fullText: buildFullText(input.segments),
    updatedAt: new Date().toISOString(),
  };

  const db = await openDb();
  try {
    const tx = db.transaction(TRANSCRIPTS_STORE, "readwrite");
    await requestToPromise(tx.objectStore(TRANSCRIPTS_STORE).put(next));
  } finally {
    db.close();
  }

  return next;
}

export async function deleteMeetingTranscript(meetingId: string) {
  const db = await openDb();
  try {
    const tx = db.transaction(TRANSCRIPTS_STORE, "readwrite");
    await requestToPromise(tx.objectStore(TRANSCRIPTS_STORE).delete(meetingId));
  } finally {
    db.close();
  }
}
