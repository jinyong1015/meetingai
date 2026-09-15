import type {
  SttAdapter,
  SttSegmentResult,
  SttTranscribeInput,
  SttTranscribeResult,
} from "./types";

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

/**
 * Local Whisper adapter (OpenAI-compatible /audio/transcriptions).
 * Points at the faster-whisper server in `/whisper-server` via WHISPER_API_URL.
 * Timed segments are supported; speaker diarization is not (single speaker).
 */
export class WhisperSttAdapter implements SttAdapter {
  readonly provider = "whisper" as const;

  async transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult> {
    const endpoint = process.env.WHISPER_API_URL?.trim();
    if (!endpoint) {
      throw new Error(
        "WHISPER_API_URL이 없습니다. 로컬 Whisper 서버 주소를 .env.local에 설정하세요.",
      );
    }

    const language = input.language ?? "ko";
    const model = process.env.WHISPER_MODEL?.trim() || "small";
    const form = new FormData();
    const bytes = new Uint8Array(input.audio);
    const ext = extensionForMime(input.mimeType || "audio/webm");
    form.append(
      "file",
      new Blob([bytes], { type: input.mimeType || "audio/webm" }),
      `meeting.${ext}`,
    );
    form.append("model", model);
    form.append("language", language);
    form.append("response_format", "verbose_json");

    const headers: HeadersInit = {};
    const apiKey = process.env.WHISPER_API_KEY?.trim();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
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
          `whisper-server를 실행했는지 확인하세요. (${detail})`,
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
      provider: this.provider,
      model,
      language,
      segments,
      diarizationSupported: false,
      remoteJobId: null,
    };
  }
}
