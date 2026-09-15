import { NextResponse } from "next/server";
import {
  createLlmAdapter,
  getLlmProvider,
  isLlmProvider,
  isLlmProviderConfigured,
  llmProviderLabel,
} from "@/lib/llm";
import type { LlmGenerateInput, LlmNoteInput, LlmProvider } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 180;

type GenerationKind = "summary" | "detail" | "both";

type GenerationsBody = {
  kind?: GenerationKind;
  provider?: string;
  meeting?: {
    title?: string;
    startedAt?: string;
    attendees?: string;
    tags?: string[];
  };
  transcript?: string;
  notes?: Array<{
    content?: string;
    timestampSec?: number | null;
    important?: boolean;
  }>;
  summaryPrompt?: string;
  detailPrompt?: string;
  summaryPromptVersion?: number;
  detailPromptVersion?: number;
};

function resolveProvider(raw: unknown): LlmProvider {
  if (typeof raw === "string" && isLlmProvider(raw)) return raw;
  return getLlmProvider();
}

function normalizeNotes(raw: GenerationsBody["notes"]): LlmNoteInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((note) => ({
      content: typeof note?.content === "string" ? note.content.trim() : "",
      timestampSec:
        typeof note?.timestampSec === "number" ? note.timestampSec : null,
      important: Boolean(note?.important),
    }))
    .filter((note) => note.content.length > 0);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerationsBody;
    const kind: GenerationKind =
      body.kind === "summary" || body.kind === "detail" || body.kind === "both"
        ? body.kind
        : "both";
    const provider = resolveProvider(body.provider);
    const transcript =
      typeof body.transcript === "string" ? body.transcript.trim() : "";

    if (!transcript) {
      return NextResponse.json(
        {
          error:
            "전사문이 비어 있어 요약·상세 회의록을 생성할 수 없습니다. 음성을 다시 전사해 주세요.",
        },
        { status: 400 },
      );
    }

    if (provider === "ollama") {
      return NextResponse.json(
        {
          error:
            "로컬 Ollama는 브라우저에서 직접 호출합니다. /api/generations 대신 설정에 등록된 Ollama 주소로 생성하세요.",
        },
        { status: 410 },
      );
    }

    if (!isLlmProviderConfigured(provider)) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
        { status: 400 },
      );
    }

    const input: LlmGenerateInput = {
      meeting: {
        title: body.meeting?.title?.trim() || "",
        startedAt: body.meeting?.startedAt?.trim() || "",
        attendees: body.meeting?.attendees?.trim() || "",
        tags: Array.isArray(body.meeting?.tags)
          ? body.meeting.tags.filter(
              (tag): tag is string => typeof tag === "string",
            )
          : [],
      },
      transcript,
      notes: normalizeNotes(body.notes),
      summaryPrompt:
        typeof body.summaryPrompt === "string"
          ? body.summaryPrompt
          : undefined,
      detailPrompt:
        typeof body.detailPrompt === "string" ? body.detailPrompt : undefined,
    };

    const adapter = createLlmAdapter(provider);
    const result: {
      provider: LlmProvider;
      model?: string;
      summaryText?: string;
      detailMinutes?: unknown;
      detailText?: string;
      summaryPromptVersion?: number;
      detailPromptVersion?: number;
      errors?: { summary?: string; detail?: string };
    } = {
      provider,
    };

    if (typeof body.summaryPromptVersion === "number") {
      result.summaryPromptVersion = body.summaryPromptVersion;
    }
    if (typeof body.detailPromptVersion === "number") {
      result.detailPromptVersion = body.detailPromptVersion;
    }

    if (kind === "summary" || kind === "both") {
      try {
        const summary = await adapter.generateSummary(input);
        result.summaryText = summary.summaryText;
        result.model = summary.model;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "요약 생성에 실패했습니다.";
        if (kind === "summary") {
          return NextResponse.json({ error: message }, { status: 502 });
        }
        result.errors = { ...(result.errors ?? {}), summary: message };
      }
    }

    if (kind === "detail" || kind === "both") {
      try {
        const detail = await adapter.generateDetail(input);
        result.detailMinutes = detail.detailMinutes;
        result.detailText = detail.detailText;
        result.model = detail.model;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "상세 회의록 생성에 실패했습니다.";
        if (kind === "detail") {
          return NextResponse.json({ error: message }, { status: 502 });
        }
        result.errors = { ...(result.errors ?? {}), detail: message };
      }
    }

    if (
      kind === "both" &&
      !result.summaryText &&
      !result.detailText &&
      result.errors
    ) {
      return NextResponse.json(
        {
          error:
            result.errors.summary ||
            result.errors.detail ||
            "회의록 생성에 실패했습니다.",
          errors: result.errors,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "회의록 생성에 실패했습니다.";
    console.error("[generations]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  const provider = getLlmProvider();
  const model =
    provider === "ollama"
      ? process.env.OLLAMA_MODEL?.trim() || "gemma4:26b"
      : process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini-2025-04-14";
  return NextResponse.json({
    provider,
    label: llmProviderLabel(provider),
    configured: isLlmProviderConfigured(provider),
    model,
  });
}
