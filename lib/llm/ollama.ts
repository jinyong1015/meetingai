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
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
} from "@/lib/types/settings";
import {
  normalizeLoopbackUrl,
  pickPreferredOllamaModel,
} from "@/lib/localEngines/loopback";

export type OllamaClientConfig = {
  baseUrl: string;
  model: string;
};

export function getOllamaBaseUrl(): string {
  const raw = process.env.OLLAMA_BASE_URL?.trim();
  if (!raw) return DEFAULT_OLLAMA_BASE_URL;
  return raw.replace(/\/$/, "");
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;
}

/** True when a base URL is available (default localhost is fine). */
export function isOllamaConfigured(): boolean {
  return Boolean(getOllamaBaseUrl());
}

export type OllamaProbeResult = {
  reachable: boolean;
  detail: string;
  models?: string[];
  /** Resolved base URL actually used (after loopback normalize). */
  baseUrl?: string;
  /** Preferred model if installed, otherwise a suggested installed model. */
  resolvedModel?: string;
  modelInstalled?: boolean;
};

/** Browser or server: probe Ollama /api/tags. */
export async function probeOllama(
  config?: Partial<OllamaClientConfig>,
  timeoutMs = 5000,
): Promise<OllamaProbeResult> {
  const rawBase = (config?.baseUrl?.trim() || getOllamaBaseUrl()).replace(
    /\/$/,
    "",
  );
  const baseUrl = normalizeLoopbackUrl(rawBase);
  const preferredModel = config?.model?.trim() || getOllamaModel();
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
      mode: "cors",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return {
        reachable: false,
        baseUrl,
        detail:
          res.status === 403
            ? `CORS 차단(HTTP 403) · Ollama를 재시작할 때 OLLAMA_ORIGINS에 '${typeof window !== "undefined" ? window.location.origin : "앱 Origin"}' 을 넣으세요.`
            : `연결 실패 · HTTP ${res.status} (${baseUrl})`,
      };
    }
    const data = (await res.json()) as {
      models?: Array<{ name?: string }>;
    };
    const models = (data.models ?? [])
      .map((m) => m.name)
      .filter((name): name is string => Boolean(name));
    const resolvedModel = pickPreferredOllamaModel(models, preferredModel);
    const modelInstalled = models.some(
      (name) =>
        name === preferredModel || name.startsWith(`${preferredModel}:`),
    );
    if (models.length === 0) {
      return {
        reachable: true,
        baseUrl,
        models,
        resolvedModel: preferredModel,
        modelInstalled: false,
        detail: `연결됨 · 설치된 모델 없음 · \`ollama pull ${preferredModel}\``,
      };
    }
    if (!modelInstalled) {
      return {
        reachable: true,
        baseUrl,
        models,
        resolvedModel,
        modelInstalled: false,
        detail: `연결됨 · 설정 모델 '${preferredModel}' 없음 → '${resolvedModel}' 사용 가능 · 필요 시 \`ollama pull ${preferredModel}\``,
      };
    }
    return {
      reachable: true,
      baseUrl,
      models,
      resolvedModel: preferredModel,
      modelInstalled: true,
      detail: `브라우저에서 사용 가능 · 모델 ${preferredModel}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "앱 Origin";
    return {
      reachable: false,
      baseUrl,
      detail:
        `연결 실패 (${baseUrl}). Ollama 실행 여부와 CORS를 확인하세요. ` +
        `PowerShell: \`$env:OLLAMA_ORIGINS="${origin},*"; ollama serve\` ` +
        `· URL 호스트는 주소창과 같게 (localhost ↔ 127.0.0.1). (${message})`,
    };
  }
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type OllamaChatResponse = {
  message?: { content?: string };
  error?: string;
};

async function createStructuredChat(
  params: {
    messages: ChatMessage[];
    schema: Record<string, unknown>;
  },
  config: OllamaClientConfig,
): Promise<string> {
  const baseUrl = normalizeLoopbackUrl(config.baseUrl.replace(/\/$/, ""));
  const model = config.model.trim() || DEFAULT_OLLAMA_MODEL;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      mode: "cors",
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "앱 Origin";
    throw new Error(
      `Ollama에 연결하지 못했습니다 (${baseUrl}). ` +
        `OLLAMA_ORIGINS에 ${origin} 을 넣고 재시작하세요. URL은 주소창과 같은 호스트(localhost/127.0.0.1)를 쓰세요. (${detail})`,
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

/** Browser-direct Ollama generation. */
export async function generateSummaryWithOllama(
  input: LlmGenerateInput,
  config: OllamaClientConfig,
): Promise<LlmSummaryResult> {
  const raw = await createStructuredChat(
    {
      messages: buildSummaryMessages(input),
      schema: SUMMARY_JSON_SCHEMA as unknown as Record<string, unknown>,
    },
    config,
  );
  const parsed = parseJsonObject(raw) as { summaryText?: unknown };
  const summaryText = asString(parsed.summaryText).trim();
  if (!summaryText) {
    throw new Error("요약 본문이 비어 있습니다.");
  }
  return {
    summaryText,
    provider: "ollama",
    model: config.model,
  };
}

export async function generateDetailWithOllama(
  input: LlmGenerateInput,
  config: OllamaClientConfig,
): Promise<LlmDetailResult> {
  const raw = await createStructuredChat(
    {
      messages: buildDetailMessages(input),
      schema: DETAIL_JSON_SCHEMA as unknown as Record<string, unknown>,
    },
    config,
  );
  const detailMinutes = normalizeDetail(parseJsonObject(raw));
  const detailText = formatDetailMinutesText(detailMinutes);
  if (!detailText.trim()) {
    throw new Error("상세 회의록 본문이 비어 있습니다.");
  }
  return {
    detailMinutes,
    detailText,
    provider: "ollama",
    model: config.model,
  };
}

/**
 * Server-side adapter. Prefer browser-direct helpers for local Ollama in the UI.
 */
export class OllamaLlmAdapter implements LlmAdapter {
  readonly provider = "ollama" as const;

  private config(): OllamaClientConfig {
    return {
      baseUrl: getOllamaBaseUrl(),
      model: getOllamaModel(),
    };
  }

  async generateSummary(input: LlmGenerateInput): Promise<LlmSummaryResult> {
    return generateSummaryWithOllama(input, this.config());
  }

  async generateDetail(input: LlmGenerateInput): Promise<LlmDetailResult> {
    return generateDetailWithOllama(input, this.config());
  }
}
