import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";
import {
  DEFAULT_DETAIL_USER_PROMPT,
  DEFAULT_SUMMARY_USER_PROMPT,
} from "@/lib/llm/prompts";

export type AppTheme = "default";

export type PromptKind = "summary" | "detail";

export const DEFAULT_WHISPER_API_URL =
  "http://127.0.0.1:8080/v1/audio/transcriptions";
export const DEFAULT_WHISPER_MODEL = "small";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "gemma4:26b";

export type AppSettings = {
  /** Singleton key for IndexedDB. */
  id: "app";
  sttProvider: SttProvider;
  llmProvider: LlmProvider;
  /** Browser → local Whisper OpenAI-compatible transcription URL. */
  whisperApiUrl: string;
  whisperModel: string;
  /** Browser → local Ollama base URL (no trailing slash). */
  ollamaBaseUrl: string;
  ollamaModel: string;
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
  whisperApiUrl: DEFAULT_WHISPER_API_URL,
  whisperModel: DEFAULT_WHISPER_MODEL,
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
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
