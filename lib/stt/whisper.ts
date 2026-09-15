import type {
  SttAdapter,
  SttSegmentResult,
  SttTranscribeInput,
  SttTranscribeResult,
} from "./types";
import {
  DEFAULT_WHISPER_API_URL,
  DEFAULT_WHISPER_MODEL,
} from "@/lib/types/settings";

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

type WhisperSegmentPayload = {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
};

function mapSegments(
  rows: WhisperSegmentPayload[] | undefined,
  fallbackText: string,
): SttSegmentResult[] {
  const mapped: SttSegmentResult[] = [];
  (rows ?? []).forEach((row, index) => {
    const text = (row.text ?? "").trim();
    if (!text) return;
    const startedAtSec = Math.max(0, Number(row.start) || 0);
    const endedRaw = Number(row.end);
    mapped.push({
      id: `whisper-${row.id ?? index}`,
      text,
      startedAtSec,
      endedAtSec: Number.isFinite(endedRaw)
        ? Math.max(startedAtSec, endedRaw)
        : undefined,
      speakerLabel: "화자 A",
      originalSpeakerLabel: "A",
    });
  });

  if (mapped.length > 0) return mapped;
  const text = fallbackText.trim();
  if (!text) return [];
  return [
    {
      id: "whisper-full",
      text,
      startedAtSec: 0,
      speakerLabel: "화자 A",
      originalSpeakerLabel: "A",
    },
  ];
}

export type WhisperClientConfig = {
  endpoint: string;
  model?: string;
  apiKey?: string;
};

export function whisperHealthUrl(endpoint: string): string {
  return endpoint.replace(/\/v1\/audio\/transcriptions\/?$/i, "/health");
}

export type WhisperProbeResult = {
  reachable: boolean;
  detail: string;
};

/** Browser or server: probe local Whisper /health. */
export async function probeWhisper(
  endpoint: string,
  timeoutMs = 3000,
): Promise<WhisperProbeResult> {
  const healthUrl = whisperHealthUrl(endpoint.trim() || DEFAULT_WHISPER_API_URL);
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return {
        reachable: false,
        detail: `연결 실패 · HTTP ${res.status} (${healthUrl})`,
      };
    }
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      model?: string;
    } | null;
    if (data?.ok) {
      return {
        reachable: true,
        detail: data.model
          ? `브라우저에서 연결됨 · 모델 ${data.model}`
          : "브라우저에서 연결됨 · /health OK",
      };
    }
    return {
      reachable: true,
      detail: "브라우저에서 응답 있음 · health 형식 확인 필요",
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      reachable: false,
      detail:
        `브라우저에서 Whisper에 연결하지 못했습니다 (${healthUrl}). ` +
        `서버 실행·CORS(WHISPER_CORS_ORIGINS)·OLLAMA와 같이 Origin 허용을 확인하세요. (${detail})`,
    };
  }
}

/** Shared Whisper transcription used by browser (and optional server). */
export async function transcribeWithWhisper(
  input: SttTranscribeInput,
  config: WhisperClientConfig,
): Promise<SttTranscribeResult> {
  const endpoint = config.endpoint.trim();
  if (!endpoint) {
    throw new Error(
      "Whisper API URL이 없습니다. 설정에서 로컬 Whisper 주소를 입력하세요.",
    );
  }

  const language = input.language ?? "ko";
  const model = config.model?.trim() || DEFAULT_WHISPER_MODEL;
  const form = new FormData();
  const bytes =
    input.audio instanceof Uint8Array
      ? input.audio
      : new Uint8Array(input.audio);
  const blobPart = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const ext = extensionForMime(input.mimeType || "audio/webm");
  form.append(
    "file",
    new Blob([blobPart], { type: input.mimeType || "audio/webm" }),
    `meeting.${ext}`,
  );
  form.append("model", model);
  form.append("language", language);
  form.append("response_format", "verbose_json");

  const headers: HeadersInit = {};
  if (config.apiKey?.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: form,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `로컬 Whisper 서버에 연결하지 못했습니다 (${endpoint}). ` +
        `whisper-server 실행, CORS, Private Network Access를 확인하세요. (${detail})`,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Whisper 전사 실패 (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    text?: string;
    segments?: WhisperSegmentPayload[];
  };
  const text = (data.text ?? "").trim();
  const segments = mapSegments(data.segments, text);

  return {
    text: text || segments.map((s) => s.text).join(" ").trim(),
    provider: "whisper",
    model,
    language,
    segments,
    diarizationSupported: false,
    remoteJobId: null,
  };
}

/**
 * Server-side adapter (legacy / status only). Prefer browser-direct
 * `transcribeWithWhisper` for local Whisper in the app UI.
 */
export class WhisperSttAdapter implements SttAdapter {
  readonly provider = "whisper" as const;

  async transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult> {
    const endpoint =
      process.env.WHISPER_API_URL?.trim() || DEFAULT_WHISPER_API_URL;
    return transcribeWithWhisper(input, {
      endpoint,
      model: process.env.WHISPER_MODEL?.trim() || DEFAULT_WHISPER_MODEL,
      apiKey: process.env.WHISPER_API_KEY?.trim(),
    });
  }
}
