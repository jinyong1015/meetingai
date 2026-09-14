import {
  AUDIO_CHUNKS_STORE,
  MEETING_AUDIO_STORE,
  openDb,
  requestToPromise,
} from "@/lib/storage/db";
import type { AudioChunk, MeetingAudio } from "@/lib/types/audio";
import { createId } from "@/lib/utils/format-time";

export async function saveAudioChunk(input: {
  meetingId: string;
  sessionId: string;
  sequence: number;
  blob: Blob;
  mimeType: string;
}): Promise<AudioChunk> {
  const chunk: AudioChunk = {
    id: createId("chunk"),
    meetingId: input.meetingId,
    sessionId: input.sessionId,
    sequence: input.sequence,
    blob: input.blob,
    mimeType: input.mimeType,
    savedAt: new Date().toISOString(),
  };

  const db = await openDb();
  try {
    const tx = db.transaction(AUDIO_CHUNKS_STORE, "readwrite");
    await requestToPromise(tx.objectStore(AUDIO_CHUNKS_STORE).put(chunk));
  } finally {
    db.close();
  }

  return chunk;
}

export async function getAudioChunksByMeeting(
  meetingId: string,
): Promise<AudioChunk[]> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(AUDIO_CHUNKS_STORE)) return [];
    const tx = db.transaction(AUDIO_CHUNKS_STORE, "readonly");
    const index = tx.objectStore(AUDIO_CHUNKS_STORE).index("meetingId");
    const rows = (await requestToPromise(index.getAll(meetingId))) as AudioChunk[];
    return rows.sort((a, b) => {
      if (a.sessionId === b.sessionId) return a.sequence - b.sequence;
      return a.savedAt.localeCompare(b.savedAt);
    });
  } finally {
    db.close();
  }
}

export async function getAudioChunksBySession(
  meetingId: string,
  sessionId: string,
): Promise<AudioChunk[]> {
  const all = await getAudioChunksByMeeting(meetingId);
  return all
    .filter((chunk) => chunk.sessionId === sessionId)
    .sort((a, b) => a.sequence - b.sequence);
}

export async function deleteAudioChunksByMeeting(meetingId: string) {
  const chunks = await getAudioChunksByMeeting(meetingId);
  if (chunks.length === 0) return;
  const db = await openDb();
  try {
    const tx = db.transaction(AUDIO_CHUNKS_STORE, "readwrite");
    const store = tx.objectStore(AUDIO_CHUNKS_STORE);
    await Promise.all(
      chunks.map((chunk) => requestToPromise(store.delete(chunk.id))),
    );
  } finally {
    db.close();
  }
}

export function assembleAudioBlob(
  chunks: AudioChunk[],
  fallbackMime = "audio/webm",
): { blob: Blob; mimeType: string } | null {
  if (chunks.length === 0) return null;
  const mimeType = chunks[0]?.mimeType || fallbackMime;
  const blob = new Blob(
    chunks.map((chunk) => chunk.blob),
    { type: mimeType },
  );
  if (blob.size === 0) return null;
  return { blob, mimeType };
}

export async function saveMeetingAudio(input: {
  meetingId: string;
  sessionId: string;
  blob: Blob;
  mimeType: string;
  durationSec: number;
  lastChunkSavedAt?: string | null;
}): Promise<MeetingAudio> {
  const next: MeetingAudio = {
    meetingId: input.meetingId,
    sessionId: input.sessionId,
    blob: input.blob,
    mimeType: input.mimeType,
    durationSec: input.durationSec,
    updatedAt: new Date().toISOString(),
    lastChunkSavedAt: input.lastChunkSavedAt ?? null,
  };

  const db = await openDb();
  try {
    const tx = db.transaction(MEETING_AUDIO_STORE, "readwrite");
    await requestToPromise(tx.objectStore(MEETING_AUDIO_STORE).put(next));
  } finally {
    db.close();
  }

  return next;
}

export async function getMeetingAudio(
  meetingId: string,
): Promise<MeetingAudio | undefined> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(MEETING_AUDIO_STORE)) return undefined;
    const tx = db.transaction(MEETING_AUDIO_STORE, "readonly");
    const row = await requestToPromise(
      tx.objectStore(MEETING_AUDIO_STORE).get(meetingId),
    );
    return row as MeetingAudio | undefined;
  } finally {
    db.close();
  }
}

export async function deleteMeetingAudio(meetingId: string) {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(MEETING_AUDIO_STORE)) return;
    const tx = db.transaction(MEETING_AUDIO_STORE, "readwrite");
    await requestToPromise(tx.objectStore(MEETING_AUDIO_STORE).delete(meetingId));
  } finally {
    db.close();
  }
}

/** Remove chunk + assembled audio for a meeting. */
export async function deleteMeetingAudioData(meetingId: string) {
  await Promise.all([
    deleteAudioChunksByMeeting(meetingId),
    deleteMeetingAudio(meetingId),
  ]);
}

/**
 * Recover the latest incomplete session blob if no finalized audio exists,
 * or return the finalized meeting audio.
 */
export async function loadPlayableMeetingAudio(meetingId: string): Promise<{
  audio: MeetingAudio | null;
  recoveredFromChunks: boolean;
} | null> {
  const existing = await getMeetingAudio(meetingId);
  if (existing && existing.blob.size > 0) {
    return { audio: existing, recoveredFromChunks: false };
  }

  const chunks = await getAudioChunksByMeeting(meetingId);
  if (chunks.length === 0) return null;

  const latestSessionId = chunks[chunks.length - 1]?.sessionId;
  if (!latestSessionId) return null;
  const sessionChunks = chunks.filter((c) => c.sessionId === latestSessionId);
  const assembled = assembleAudioBlob(sessionChunks);
  if (!assembled) return null;

  const lastChunk = sessionChunks[sessionChunks.length - 1];
  const audio: MeetingAudio = {
    meetingId,
    sessionId: latestSessionId,
    blob: assembled.blob,
    mimeType: assembled.mimeType,
    durationSec: 0,
    updatedAt: new Date().toISOString(),
    lastChunkSavedAt: lastChunk?.savedAt ?? null,
  };

  return { audio, recoveredFromChunks: true };
}
