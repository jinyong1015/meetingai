import { openDb, requestToPromise, SETTINGS_STORE } from "@/lib/storage/db";
import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";
import {
  DEFAULT_APP_SETTINGS,
  SETTINGS_CHANGED_EVENT,
  type AppSettings,
  type AppTheme,
} from "@/lib/types/settings";

function isSttProvider(value: unknown): value is SttProvider {
  return value === "assemblyai" || value === "whisper";
}

function isLlmProvider(value: unknown): value is LlmProvider {
  return value === "openai" || value === "ollama";
}

function isTheme(value: unknown): value is AppTheme {
  return value === "default";
}

function normalizeUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const browserTz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "Asia/Seoul";

  return {
    id: "app",
    sttProvider: isSttProvider(raw?.sttProvider)
      ? raw.sttProvider
      : DEFAULT_APP_SETTINGS.sttProvider,
    llmProvider: isLlmProvider(raw?.llmProvider)
      ? raw.llmProvider
      : DEFAULT_APP_SETTINGS.llmProvider,
    whisperApiUrl: normalizeUrl(
      raw?.whisperApiUrl,
      DEFAULT_APP_SETTINGS.whisperApiUrl,
    ),
    whisperModel: normalizeUrl(
      raw?.whisperModel,
      DEFAULT_APP_SETTINGS.whisperModel,
    ),
    ollamaBaseUrl: normalizeUrl(
      raw?.ollamaBaseUrl,
      DEFAULT_APP_SETTINGS.ollamaBaseUrl,
    ).replace(/\/$/, ""),
    ollamaModel: normalizeUrl(
      raw?.ollamaModel,
      DEFAULT_APP_SETTINGS.ollamaModel,
    ),
    timezone:
      typeof raw?.timezone === "string" && raw.timezone.trim()
        ? raw.timezone.trim()
        : browserTz || DEFAULT_APP_SETTINGS.timezone,
    askAiAfterRecording:
      typeof raw?.askAiAfterRecording === "boolean"
        ? raw.askAiAfterRecording
        : DEFAULT_APP_SETTINGS.askAiAfterRecording,
    theme: isTheme(raw?.theme) ? raw.theme : DEFAULT_APP_SETTINGS.theme,
    summaryPrompt:
      typeof raw?.summaryPrompt === "string" && raw.summaryPrompt.trim()
        ? raw.summaryPrompt
        : DEFAULT_APP_SETTINGS.summaryPrompt,
    detailPrompt:
      typeof raw?.detailPrompt === "string" && raw.detailPrompt.trim()
        ? raw.detailPrompt
        : DEFAULT_APP_SETTINGS.detailPrompt,
    summaryPromptVersion:
      typeof raw?.summaryPromptVersion === "number" &&
      Number.isFinite(raw.summaryPromptVersion) &&
      raw.summaryPromptVersion >= 1
        ? Math.floor(raw.summaryPromptVersion)
        : DEFAULT_APP_SETTINGS.summaryPromptVersion,
    detailPromptVersion:
      typeof raw?.detailPromptVersion === "number" &&
      Number.isFinite(raw.detailPromptVersion) &&
      raw.detailPromptVersion >= 1
        ? Math.floor(raw.detailPromptVersion)
        : DEFAULT_APP_SETTINGS.detailPromptVersion,
    webhookEnabled:
      typeof raw?.webhookEnabled === "boolean"
        ? raw.webhookEnabled
        : DEFAULT_APP_SETTINGS.webhookEnabled,
    webhookDestinationAlias:
      typeof raw?.webhookDestinationAlias === "string" &&
      raw.webhookDestinationAlias.trim()
        ? raw.webhookDestinationAlias.trim()
        : DEFAULT_APP_SETTINGS.webhookDestinationAlias,
    webhookIncludeMeetingInfo:
      typeof raw?.webhookIncludeMeetingInfo === "boolean"
        ? raw.webhookIncludeMeetingInfo
        : DEFAULT_APP_SETTINGS.webhookIncludeMeetingInfo,
    webhookIncludeSummary:
      typeof raw?.webhookIncludeSummary === "boolean"
        ? raw.webhookIncludeSummary
        : DEFAULT_APP_SETTINGS.webhookIncludeSummary,
    webhookIncludeDetail:
      typeof raw?.webhookIncludeDetail === "boolean"
        ? raw.webhookIncludeDetail
        : DEFAULT_APP_SETTINGS.webhookIncludeDetail,
    webhookIncludeActionItems:
      typeof raw?.webhookIncludeActionItems === "boolean"
        ? raw.webhookIncludeActionItems
        : DEFAULT_APP_SETTINGS.webhookIncludeActionItems,
    webhookIncludeTranscript:
      typeof raw?.webhookIncludeTranscript === "boolean"
        ? raw.webhookIncludeTranscript
        : DEFAULT_APP_SETTINGS.webhookIncludeTranscript,
    webhookIncludeNotes:
      typeof raw?.webhookIncludeNotes === "boolean"
        ? raw.webhookIncludeNotes
        : DEFAULT_APP_SETTINGS.webhookIncludeNotes,
    updatedAt:
      typeof raw?.updatedAt === "string"
        ? raw.updatedAt
        : DEFAULT_APP_SETTINGS.updatedAt,
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, "readonly");
    const row = await requestToPromise(
      tx.objectStore(SETTINGS_STORE).get("app"),
    );
    if (!row || typeof row !== "object") {
      return normalizeSettings(null);
    }
    return normalizeSettings(row as Partial<AppSettings>);
  } finally {
    db.close();
  }
}

export async function saveAppSettings(
  patch: Partial<Omit<AppSettings, "id" | "updatedAt">>,
): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = normalizeSettings({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    await requestToPromise(tx.objectStore(SETTINGS_STORE).put(next));
  } finally {
    db.close();
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: next }),
    );
  }

  return next;
}
