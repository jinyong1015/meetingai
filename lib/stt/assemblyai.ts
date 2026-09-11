import type { SttAdapter, SttTranscribeInput, SttTranscribeResult } from "./types";

const ASSEMBLYAI_BASE = "https://api.assemblyai.com";
/** PRD: Korean validation baseline for AssemblyAI. */
const ASSEMBLYAI_KO_MODEL = "universal-2";

function getApiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!key) {
    throw new Error("ASSEMBLYAI_API_KEY가 설정되지 않았습니다.");
  }
  return key;
}

async function uploadAudio(apiKey: string, audio: Buffer): Promise<string> {
  const res = await fetch(`${ASSEMBLYAI_BASE}/v2/upload`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: new Uint8Array(audio),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AssemblyAI 업로드 실패 (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { upload_url?: string };
  if (!data.upload_url) {
    throw new Error("AssemblyAI 업로드 URL을 받지 못했습니다.");
  }
  return data.upload_url;
}

async function createTranscript(
  apiKey: string,
  audioUrl: string,
  language: string,
): Promise<string> {
  const res = await fetch(`${ASSEMBLYAI_BASE}/v2/transcript`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: language,
      speech_models: [ASSEMBLYAI_KO_MODEL],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AssemblyAI 전사 요청 실패 (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error("AssemblyAI 전사 ID를 받지 못했습니다.");
  }
  return data.id;
}

async function pollTranscript(
  apiKey: string,
  transcriptId: string,
): Promise<string> {
  const endpoint = `${ASSEMBLYAI_BASE}/v2/transcript/${transcriptId}`;
  const started = Date.now();
  const timeoutMs = 90_000;

  while (Date.now() - started < timeoutMs) {
    const res = await fetch(endpoint, {
      headers: { authorization: apiKey },
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`AssemblyAI 상태 조회 실패 (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as {
      status?: string;
      text?: string | null;
      error?: string;
    };

    if (data.status === "completed") {
      return (data.text ?? "").trim();
    }
    if (data.status === "error") {
      throw new Error(data.error || "AssemblyAI 전사에 실패했습니다.");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("AssemblyAI 전사 대기 시간이 초과되었습니다.");
}

export class AssemblyAiSttAdapter implements SttAdapter {
  readonly provider = "assemblyai" as const;

  async transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult> {
    const apiKey = getApiKey();
    const language = input.language ?? "ko";
    const uploadUrl = await uploadAudio(apiKey, input.audio);
    const transcriptId = await createTranscript(apiKey, uploadUrl, language);
    const text = await pollTranscript(apiKey, transcriptId);

    return {
      text,
      provider: this.provider,
      model: ASSEMBLYAI_KO_MODEL,
      language,
    };
  }
}
