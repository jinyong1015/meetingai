import type { LlmProvider } from "@/lib/llm/types";
import type { MeetingDetailMinutes } from "@/lib/types/detail";

export type GenerationSource = "mock" | "llm";

/** Latest working draft of AI (or preview) generation results for one meeting. */
export type MeetingGeneration = {
  meetingId: string;
  /** Plain-text meeting summary only (working draft). */
  summaryText: string | null;
  /** Flattened detailed minutes text (export / fallback). */
  detailText: string | null;
  /** Structured detailed minutes for the detail tab. */
  detailMinutes: MeetingDetailMinutes | null;
  /** Preserved first/latest AI summary before user edits. */
  aiOriginalSummaryText?: string | null;
  /** Preserved AI structured detail before user edits. */
  aiOriginalDetailMinutes?: MeetingDetailMinutes | null;
  aiOriginalDetailText?: string | null;
  /** Fingerprint of transcript + AI-included notes used for this draft. */
  inputFingerprint?: string | null;
  /** Latest confirmed version number, if any. */
  confirmedVersionNumber?: number | null;
  source: GenerationSource;
  llmProvider?: LlmProvider | string;
  model?: string;
  updatedAt: string;
};

export type MeetingResultTab =
  | "transcript"
  | "summary"
  | "detail"
  | "history"
  | "integrations";
