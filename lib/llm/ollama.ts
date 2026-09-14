import {
  buildDetailMessages,
  buildSummaryMessages,
} from "@/lib/llm/prompts";
import { asString, normalizeDetail, parseJsonObject } from "@/lib/llm/parse";
import { DETAIL_JSON_SCHEMA, SUMMARY_JSON_SCHEMA } from "@/lib/llm/schemas";
import type {
  LlmAdapter,
  LlmDetailResult,
  LlmGenerateInput,
  LlmSummaryResult,
} from "@/lib/llm/types";
import { formatDetailMinutesText } from "@/lib/types/detail";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1";

export function getOllamaBaseUrl(): string {
  const raw = process.env.OLLAMA_BASE_URL?.trim();
  if (!raw) return DEFAULT_BASE_URL;
  return raw.replace(/\/$/, "");
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL;
}

/** True when a base URL is available (default localhost is fine). */
export function isOllamaConfigured(): boolean {
  return Boolean(getOllamaBaseUrl());
}

export type OllamaProbeResult = {
  reachable: boolean;
  detail: string;
  models?: string[];
};

export async function probeOllama(
  timeoutMs = 3000,
): Promise<OllamaProbeResult> {
  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaModel();
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return {
        reachable: false,
        detail: `연결 실패 · HTTP ${res.status} (${baseUrl})`,
      };
    }
    const data = (await res.json()) as {
      models?: Array<{ name?: string }>;
    };
    const models = (data.models ?? [])
      .map((m) => m.name)
      .filter((name): name is string => Boolean(name));
    const hasModel = models.some(
      (name) => name === model || name.startsWith(`${model}:`),
    );
    if (models.length === 0) {
      return {
        reachable: true,
        detail: `연결됨 · 설치된 모델 없음 · \`ollama pull ${model}\``,
        models,
      };
    }
    if (!hasModel) {
      return {
        reachable: true,
        detail: `연결됨 · 모델 '${model}' 미설치 · \`ollama pull ${model}\``,
        models,
      };
    }
    return {
      reachable: true,
      detail: `로컬 사용 가능 · 모델 ${model}`,
      models,
    };
  } catch {
    return {
      reachable: false,
      detail:
        `연결 실패 · Ollama 미실행. https://ollama.com/download 에서 설치 후 실행하고, \`ollama pull ${model}\` 로 모델을 받은 뒤 다시 열어 주세요`,
    };
  }
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type OllamaChatResponse = {
  message?: { content?: string };
  error?: string;
};

async function createStructuredChat(params: {
  messages: ChatMessage[];
  schema: Record<string, unknown>;
}): Promise<string> {
  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaModel();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: params.schema,
        messages: params.messages,
        options: {
          temperature: 0.2,
        },
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new Error(
      `Ollama에 연결하지 못했습니다. '${baseUrl}'에서 Ollama가 실행 중인지 확인하세요.`,
    );
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) detail = errBody.error;
    } catch {
      // ignore
    }
    if (res.status === 404) {
      throw new Error(
        `Ollama 모델 '${model}'을 찾을 수 없습니다. \`ollama pull ${model}\` 후 다시 시도하세요.`,
      );
    }
    throw new Error(`Ollama 요청 실패: ${detail}`);
  }

  const data = (await res.json()) as OllamaChatResponse;
  if (data.error) {
    throw new Error(data.error);
  }
  const text = data.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("Ollama 응답이 비어 있습니다.");
  }
  return text;
}

export class OllamaLlmAdapter implements LlmAdapter {
  readonly provider = "ollama" as const;

  async generateSummary(input: LlmGenerateInput): Promise<LlmSummaryResult> {
    const raw = await createStructuredChat({
      messages: buildSummaryMessages(input),
      schema: SUMMARY_JSON_SCHEMA as unknown as Record<string, unknown>,
    });
    const parsed = parseJsonObject(raw) as { summaryText?: unknown };
    const summaryText = asString(parsed.summaryText).trim();
    if (!summaryText) {
      throw new Error("요약 본문이 비어 있습니다.");
    }
    return {
      summaryText,
      provider: this.provider,
      model: getOllamaModel(),
    };
  }

  async generateDetail(input: LlmGenerateInput): Promise<LlmDetailResult> {
    const raw = await createStructuredChat({
      messages: buildDetailMessages(input),
      schema: DETAIL_JSON_SCHEMA as unknown as Record<string, unknown>,
    });
    const detailMinutes = normalizeDetail(parseJsonObject(raw));
    const detailText = formatDetailMinutesText(detailMinutes);
    if (!detailText.trim()) {
      throw new Error("상세 회의록 본문이 비어 있습니다.");
    }
    return {
      detailMinutes,
      detailText,
      provider: this.provider,
      model: getOllamaModel(),
    };
  }
}
