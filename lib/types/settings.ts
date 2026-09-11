import type { SttProvider } from "@/lib/stt/types";

export type AppSettings = {
  /** Singleton key for IndexedDB. */
  id: "app";
  sttProvider: SttProvider;
  updatedAt: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: "app",
  sttProvider: "assemblyai",
  updatedAt: new Date(0).toISOString(),
};

export const SETTINGS_CHANGED_EVENT = "meetingai:settings-changed";

export function sttProviderLabel(provider: SttProvider): string {
  if (provider === "whisper") return "Whisper";
  return "AssemblyAI";
}
