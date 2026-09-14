import type { MeetingDetailMinutes } from "@/lib/types/detail";

export type LlmProvider = "openai" | "ollama";

export type LlmMeetingContext = {
  title: string;
  startedAt: string;
  attendees: string;
  tags: string[];
};

export type LlmNoteInput = {
  content: string;
  timestampSec: number | null;
  important: boolean;
};

export type LlmGenerateInput = {
  meeting: LlmMeetingContext;
  transcript: string;
  notes: LlmNoteInput[];
};

export type LlmSummaryResult = {
  summaryText: string;
  provider: LlmProvider;
  model: string;
};

export type LlmDetailResult = {
  detailMinutes: MeetingDetailMinutes;
  detailText: string;
  provider: LlmProvider;
  model: string;
};

export type LlmAdapter = {
  readonly provider: LlmProvider;
  generateSummary(input: LlmGenerateInput): Promise<LlmSummaryResult>;
  generateDetail(input: LlmGenerateInput): Promise<LlmDetailResult>;
};
