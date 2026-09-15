"use client";

import { useEffect, useState } from "react";
import { getAppSettings } from "@/lib/storage/settings";
import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";
import {
  DEFAULT_APP_SETTINGS,
  SETTINGS_CHANGED_EVENT,
  type AppSettings,
} from "@/lib/types/settings";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getAppSettings().then((loaded) => {
      if (!cancelled) {
        setSettings(loaded);
        setReady(true);
      }
    });

    function onChanged(event: Event) {
      const detail = (event as CustomEvent<AppSettings>).detail;
      if (detail?.id === "app") {
        setSettings(detail);
      } else {
        void getAppSettings().then((loaded) => {
          if (!cancelled) setSettings(loaded);
        });
      }
    }

    window.addEventListener(SETTINGS_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onChanged);
    };
  }, []);

  return {
    settings,
    ready,
    sttProvider: settings.sttProvider as SttProvider,
    llmProvider: settings.llmProvider as LlmProvider,
    whisperApiUrl: settings.whisperApiUrl,
    whisperModel: settings.whisperModel,
    ollamaBaseUrl: settings.ollamaBaseUrl,
    ollamaModel: settings.ollamaModel,
    timezone: settings.timezone,
    askAiAfterRecording: settings.askAiAfterRecording,
    summaryPrompt: settings.summaryPrompt,
    detailPrompt: settings.detailPrompt,
    summaryPromptVersion: settings.summaryPromptVersion,
    detailPromptVersion: settings.detailPromptVersion,
  };
}
