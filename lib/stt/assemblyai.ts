import { speakerLabelFromEngine } from "@/lib/types/transcript";
import type {
  SttAdapter,
  SttJobResult,
  SttSegmentResult,
  SttTranscribeInput,
  SttTranscribeResult,
} from "./types";

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

async function uploadAudio(
  apiKey: string,
  audio: ArrayBuffer | Uint8Array,
): Promise<string> {
  const body =
    audio instanceof Uint8Array
      ? audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength)
      : audio;
  const res = await fetch(`${ASSEMBLYAI_BASE}/v2/upload`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: body as ArrayBuffer,
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

type AssemblyUtterance = {
  speaker?: string | number;
  start?: number;
  end?: number;
  text?: string;
};

type AssemblyTranscriptPayload = {
  id?: string;
  status?: string;
  text?: string | null;
  error?: string;
  utterances?: AssemblyUtterance[] | null;
  words?: Array<{ start?: number; end?: number; text?: string }> | null;
};

function msToSec(ms: number | undefined): number {
  if (ms == null || !Number.isFinite(ms)) return 0;
  return Math.max(0, ms / 1000);
}

function mapUtterances(utterances: AssemblyUtterance[]): SttSegmentResult[] {
  const rows: SttSegmentResult[] = [];
  utterances.forEach((row, index) => {
    const text = (row.text ?? "").trim();
    if (!text) return;
    const original = row.speaker != null ? String(row.speaker) : null;
    rows.push({
      id: `aai-utt-${index}`,
      text,
      startedAtSec: msToSec(row.start),
      endedAtSec: msToSec(row.end),
      speakerLabel: speakerLabelFromEngine(row.speaker),
      originalSpeakerLabel: original,
    });
  });
  return rows;
}

function mapFromText(text: string): SttSegmentResult[] {
  const body = text.trim();
  if (!body) return [];
  return [
    {
      id: "aai-full",
      text: body,
      startedAtSec: 0,
      speakerLabel: "화자 A",
      originalSpeakerLabel: "A",
    },
  ];
}

function toResult(
  data: AssemblyTranscriptPayload,
  language: string,
): SttTranscribeResult {
  const text = (data.text ?? "").trim();
  const utterances = data.utterances ?? [];
  const segments =
    utterances.length > 0 ? mapUtterances(utterances) : mapFromText(text);
  const speakers = new Set(
    segments
      .map((s) => s.originalSpeakerLabel || s.speakerLabel)
      .filter(Boolean),
  );

  return {
    text: text || segments.map((s) => s.text).join(" ").trim(),
    provider: "assemblyai",
    model: ASSEMBLYAI_KO_MODEL,
    language,
    segments,
    diarizationSupported: speakers.size > 1,
    remoteJobId: data.id ?? null,
  };
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
      speaker_labels: true,
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

async function fetchTranscript(
  apiKey: string,
  transcriptId: string,
): Promise<AssemblyTranscriptPayload> {
  const res = await fetch(
    `${ASSEMBLYAI_BASE}/v2/transcript/${transcriptId}`,
    {
      headers: { authorization: apiKey },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AssemblyAI 상태 조회 실패 (${res.status}): ${detail}`);
  }
  return (await res.json()) as AssemblyTranscriptPayload;
}

async function pollTranscript(
  apiKey: string,
  transcriptId: string,
  language: string,
): Promise<SttTranscribeResult> {
  const started = Date.now();
  const timeoutMs = 90_000;

  while (Date.now() - started < timeoutMs) {
    const data = await fetchTranscript(apiKey, transcriptId);

    if (data.status === "completed") {
      return toResult({ ...data, id: transcriptId }, language);
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

  async startJob(input: SttTranscribeInput) {
    const apiKey = getApiKey();
    const language = input.language ?? "ko";
    const uploadUrl = await uploadAudio(apiKey, input.audio);
    const transcriptId = await createTranscript(apiKey, uploadUrl, language);
    return {
      remoteJobId: transcriptId,
      provider: this.provider,
      model: ASSEMBLYAI_KO_MODEL,
    };
  }

  async transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult> {
    const started = await this.startJob(input);
    const apiKey = getApiKey();
    const language = input.language ?? "ko";
    return pollTranscript(apiKey, started.remoteJobId, language);
  }

  async getJob(jobId: string): Promise<SttJobResult> {
    const apiKey = getApiKey();
    const language = "ko";
    const data = await fetchTranscript(apiKey, jobId);

    if (data.status === "completed") {
      return {
        ...toResult({ ...data, id: jobId }, language),
        status: "completed",
      };
    }
    if (data.status === "error") {
      return {
        text: "",
        provider: this.provider,
        model: ASSEMBLYAI_KO_MODEL,
        language,
        segments: [],
        diarizationSupported: false,
        remoteJobId: jobId,
        status: "error",
        error: data.error || "AssemblyAI 전사에 실패했습니다.",
      };
    }

    const queued =
      data.status === "queued" || data.status === "submitted"
        ? "queued"
        : "processing";

    return {
      text: "",
      provider: this.provider,
      model: ASSEMBLYAI_KO_MODEL,
      language,
      segments: [],
      diarizationSupported: false,
      remoteJobId: jobId,
      status: queued,
    };
  }
}
