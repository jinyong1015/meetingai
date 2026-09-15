import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";
import {
  DEFAULT_DETAIL_USER_PROMPT,
  DEFAULT_SUMMARY_USER_PROMPT,
} from "@/lib/llm/prompts";

export type AppTheme = "default";

export type PromptKind = "summary" | "detail";

export type AppSettings = {
  /** Singleton key for IndexedDB. */
  id: "app";
  sttProvider: SttProvider;
  llmProvider: LlmProvider;
  /** IANA timezone, e.g. Asia/Seoul */
  timezone: string;
  /** After recording stop, show AI consent / generation prompt. */
  askAiAfterRecording: boolean;
  /** Applied theme id (multi-theme picker is P1). */
  theme: AppTheme;
  summaryPrompt: string;
  detailPrompt: string;
  summaryPromptVersion: number;
  detailPromptVersion: number;
  updatedAt: string;
};

export const PROMPT_MIN_LENGTH = 20;
export const PROMPT_MAX_LENGTH = 4000;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: "app",
  sttProvider: "whisper",
  llmProvider: "ollama",
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul"
      : "Asia/Seoul",
  askAiAfterRecording: true,
  theme: "default",
  summaryPrompt: DEFAULT_SUMMARY_USER_PROMPT,
  detailPrompt: DEFAULT_DETAIL_USER_PROMPT,
  summaryPromptVersion: 1,
  detailPromptVersion: 1,
  updatedAt: new Date(0).toISOString(),
};

export const SETTINGS_CHANGED_EVENT = "meetingai:settings-changed";

export const COMMON_TIMEZONES = [
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
] as const;

export function sttProviderLabel(provider: SttProvider): string {
  if (provider === "whisper") return "Whisper";
  return "AssemblyAI";
}

export function llmProviderLabel(provider: LlmProvider): string {
  if (provider === "ollama") return "Ollama";
  return "OpenAI";
}

export function isCloudLlm(provider: LlmProvider): boolean {
  return provider === "openai";
}

export function validatePrompt(text: string): string | null {
  const length = text.trim().length;
  if (length < PROMPT_MIN_LENGTH) {
    return `최소 ${PROMPT_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  if (length > PROMPT_MAX_LENGTH) {
    return `최대 ${PROMPT_MAX_LENGTH}자까지 입력할 수 있습니다.`;
  }
  return null;
}

export function defaultPromptFor(kind: PromptKind): string {
  return kind === "summary"
    ? DEFAULT_SUMMARY_USER_PROMPT
    : DEFAULT_DETAIL_USER_PROMPT;
}
