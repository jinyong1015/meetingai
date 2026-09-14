import { openDb, requestToPromise, SETTINGS_STORE } from "@/lib/storage/db";
import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";
import {
  DEFAULT_APP_SETTINGS,
  SETTINGS_CHANGED_EVENT,
  type AppSettings,
} from "@/lib/types/settings";

function isSttProvider(value: unknown): value is SttProvider {
  return value === "assemblyai" || value === "whisper";
}

function isLlmProvider(value: unknown): value is LlmProvider {
  return value === "openai" || value === "ollama";
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, "readonly");
    const row = await requestToPromise(
      tx.objectStore(SETTINGS_STORE).get("app"),
    );
    if (!row || typeof row !== "object") {
      return { ...DEFAULT_APP_SETTINGS };
    }
    const raw = row as Partial<AppSettings>;
    return {
      id: "app",
      sttProvider: isSttProvider(raw.sttProvider)
        ? raw.sttProvider
        : DEFAULT_APP_SETTINGS.sttProvider,
      llmProvider: isLlmProvider(raw.llmProvider)
        ? raw.llmProvider
        : DEFAULT_APP_SETTINGS.llmProvider,
      updatedAt:
        typeof raw.updatedAt === "string"
          ? raw.updatedAt
          : DEFAULT_APP_SETTINGS.updatedAt,
    };
  } finally {
    db.close();
  }
}

export async function saveAppSettings(
  patch: Pick<AppSettings, "sttProvider" | "llmProvider">,
): Promise<AppSettings> {
  const next: AppSettings = {
    id: "app",
    sttProvider: patch.sttProvider,
    llmProvider: patch.llmProvider,
    updatedAt: new Date().toISOString(),
  };

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
