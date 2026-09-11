import type { SttAdapter, SttTranscribeInput, SttTranscribeResult } from "./types";

/**
 * Local Whisper adapter (OpenAI-compatible /audio/transcriptions).
 * Configure WHISPER_API_URL in `.env.local` to enable.
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
    const form = new FormData();
    const bytes = new Uint8Array(input.audio);
    form.append(
      "file",
      new Blob([bytes], { type: input.mimeType || "audio/wav" }),
      "chunk.wav",
    );
    form.append("model", process.env.WHISPER_MODEL?.trim() || "whisper-1");
    form.append("language", language);

    const headers: HeadersInit = {};
    const apiKey = process.env.WHISPER_API_KEY?.trim();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Whisper 전사 실패 (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as { text?: string };
    return {
      text: (data.text ?? "").trim(),
      provider: this.provider,
      model: process.env.WHISPER_MODEL?.trim() || "whisper-1",
      language,
    };
  }
}
