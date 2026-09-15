import { openDb, requestToPromise, TRANSCRIPTS_STORE } from "@/lib/storage/db";
import type { SttProvider } from "@/lib/stt/types";
import {
  buildFullText,
  type MeetingTranscript,
  type TranscriptJobStatus,
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
  model?: string;
  diarizationSupported?: boolean;
  remoteJobId?: string | null;
  status?: TranscriptJobStatus;
}): Promise<MeetingTranscript> {
  const next: MeetingTranscript = {
    meetingId: input.meetingId,
    segments: input.segments,
    provider: input.provider,
    fullText: buildFullText(input.segments),
    updatedAt: new Date().toISOString(),
    model: input.model,
    diarizationSupported: input.diarizationSupported,
    remoteJobId: input.remoteJobId ?? null,
    status: input.status ?? "completed",
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

export async function getAllTranscripts(): Promise<MeetingTranscript[]> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(TRANSCRIPTS_STORE)) return [];
    const tx = db.transaction(TRANSCRIPTS_STORE, "readonly");
    const rows = await requestToPromise(tx.objectStore(TRANSCRIPTS_STORE).getAll());
    return rows as MeetingTranscript[];
  } finally {
    db.close();
  }
}

export async function findMeetingIdsByTranscriptQuery(
  query: string,
): Promise<string[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const transcripts = await getAllTranscripts();
  const ids = new Set<string>();
  for (const transcript of transcripts) {
    if (transcript.fullText.toLowerCase().includes(q)) {
      ids.add(transcript.meetingId);
    }
  }
  return [...ids];
}
