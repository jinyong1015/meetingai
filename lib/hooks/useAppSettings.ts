"use client";

import { useEffect, useState } from "react";
import { getAppSettings } from "@/lib/storage/settings";
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
      if (detail?.sttProvider) {
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
  };
}
