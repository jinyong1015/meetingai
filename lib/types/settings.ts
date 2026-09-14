import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";

export type AppSettings = {
  /** Singleton key for IndexedDB. */
  id: "app";
  sttProvider: SttProvider;
  llmProvider: LlmProvider;
  updatedAt: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: "app",
  sttProvider: "whisper",
  llmProvider: "ollama",
  updatedAt: new Date(0).toISOString(),
};

export const SETTINGS_CHANGED_EVENT = "meetingai:settings-changed";

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
