/** Linked source for a decision or action item (SCR-04 evidence player). */

export type EvidenceKind = "transcript" | "note";

export type EvidenceRef = {
  kind: EvidenceKind;
  /** Transcript segment id when kind is transcript. */
  segmentId?: string;
  /** Note id when kind is note. */
  noteId?: string;
  /** Playback start in recording timeline seconds. */
  startTimeSec?: number | null;
  /** Playback end in recording timeline seconds (optional). */
  endTimeSec?: number | null;
};

export type ResolvedEvidence = {
  ref: EvidenceRef;
  valid: boolean;
  error?: string;
  speakerLabel?: string | null;
  text: string;
  /** Note-only metadata */
  noteImportant?: boolean;
  noteIncludeInAI?: boolean;
  startTimeSec: number | null;
  endTimeSec: number | null;
};
