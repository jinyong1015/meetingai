import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_WHISPER_API_URL,
  DEFAULT_WHISPER_MODEL,
} from "@/lib/types/settings";

export type LocalEngineDefaults = {
  whisperApiUrl: string;
  whisperModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
};

/** Non-secret URL/model defaults from server env (safe to expose to the browser). */
export function getLocalEngineDefaultsFromEnv(): LocalEngineDefaults {
  const whisperApiUrl =
    process.env.WHISPER_API_URL?.trim() || DEFAULT_WHISPER_API_URL;
  const whisperModel =
    process.env.WHISPER_MODEL?.trim() || DEFAULT_WHISPER_MODEL;
  const ollamaBaseUrl = (
    process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL
  ).replace(/\/$/, "");
  const ollamaModel =
    process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;

  return {
    whisperApiUrl,
    whisperModel,
    ollamaBaseUrl,
    ollamaModel,
  };
}
