import { NextResponse } from "next/server";
import {
  getLlmProvider,
  getOllamaModel,
  getOpenAiModel,
  isOpenAiConfigured,
  llmProviderLabel,
  probeOllama,
} from "@/lib/llm";

export const runtime = "nodejs";

type EngineStatus = {
  configured: boolean;
  label: string;
  detail: string;
};

function openAiStatus(): EngineStatus {
  const configured = isOpenAiConfigured();
  const model = getOpenAiModel();
  return {
    configured,
    label: "OpenAI",
    detail: configured
      ? `설정됨 · 모델 ${model}`
      : "미설정 · OPENAI_API_KEY 필요",
  };
}

async function ollamaStatus(): Promise<EngineStatus> {
  const probe = await probeOllama();
  return {
    configured: probe.reachable,
    label: "Ollama",
    detail: probe.detail,
  };
}

export async function GET() {
  const [openai, ollama] = await Promise.all([
    Promise.resolve(openAiStatus()),
    ollamaStatus(),
  ]);
  const defaultProvider = getLlmProvider();
  return NextResponse.json({
    defaultProvider,
    defaultLabel: llmProviderLabel(defaultProvider),
    ollamaModel: getOllamaModel(),
    openaiModel: getOpenAiModel(),
    engines: {
      openai,
      ollama,
    },
  });
}
