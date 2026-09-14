import OpenAI from "openai";
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

const DEFAULT_MODEL = "gpt-4.1-mini-2025-04-14";

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function createClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }
  return new OpenAI({ apiKey });
}

async function createStructuredResponse(params: {
  messages: Array<{ role: "system" | "user"; content: string }>;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<string> {
  const client = createClient();
  const model = getOpenAiModel();

  const response = await client.responses.create({
    model,
    store: false,
    input: params.messages,
    text: {
      format: {
        type: "json_schema",
        name: params.schemaName,
        strict: true,
        schema: params.schema,
      },
    },
  });

  const text = response.output_text?.trim() ?? "";
  if (!text) {
    throw new Error("OpenAI 응답이 비어 있습니다.");
  }
  return text;
}

export class OpenAiLlmAdapter implements LlmAdapter {
  readonly provider = "openai" as const;

  async generateSummary(input: LlmGenerateInput): Promise<LlmSummaryResult> {
    const raw = await createStructuredResponse({
      messages: buildSummaryMessages(input),
      schemaName: "meeting_summary",
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
      model: getOpenAiModel(),
    };
  }

  async generateDetail(input: LlmGenerateInput): Promise<LlmDetailResult> {
    const raw = await createStructuredResponse({
      messages: buildDetailMessages(input),
      schemaName: "meeting_detail_minutes",
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
      model: getOpenAiModel(),
    };
  }
}
