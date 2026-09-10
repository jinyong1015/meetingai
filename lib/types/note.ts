export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type Note = {
  id: string;
  meetingId: string;
  content: string;
  /** Recording timeline seconds (pause excluded). Null = before/after recording. */
  timestampSec: number | null;
  important: boolean;
  includeInAI: boolean;
  createdAt: string;
  updatedAt: string;
};

export const NOTE_MAX_TOTAL_CHARS = 20_000;
