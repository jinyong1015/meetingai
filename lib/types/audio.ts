/** One MediaRecorder data chunk persisted for recovery (REC-04). */
export type AudioChunk = {
  id: string;
  meetingId: string;
  sessionId: string;
  sequence: number;
  blob: Blob;
  mimeType: string;
  savedAt: string;
};

/** Assembled original recording for playback / download (REC-06). */
export type MeetingAudio = {
  meetingId: string;
  sessionId: string;
  blob: Blob;
  mimeType: string;
  durationSec: number;
  updatedAt: string;
  /** Last chunk save time while recording (shown after recovery). */
  lastChunkSavedAt: string | null;
};
