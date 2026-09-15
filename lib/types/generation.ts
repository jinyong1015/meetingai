import type { LlmProvider } from "@/lib/llm/types";
import type { MeetingDetailMinutes } from "@/lib/types/detail";

export type GenerationSource = "mock" | "llm";

/** Latest AI (or preview) generation results for one meeting. */
export type MeetingGeneration = {
  meetingId: string;
  /** Plain-text meeting summary only. */
  summaryText: string | null;
  /** Flattened detailed minutes text (export / fallback). */
  detailText: string | null;
  /** Structured detailed minutes for the detail tab. */
  detailMinutes: MeetingDetailMinutes | null;
  source: GenerationSource;
  llmProvider?: LlmProvider | string;
  model?: string;
  updatedAt: string;
};

export type MeetingResultTab = "summary" | "detail" | "transcript";
