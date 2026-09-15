import { NextResponse } from "next/server";
import {
  getLlmProvider,
  getOllamaModel,
  getOpenAiModel,
  isOpenAiConfigured,
  llmProviderLabel,
} from "@/lib/llm";
import { getLocalEngineDefaultsFromEnv } from "@/lib/localEngines/defaults";

export const runtime = "nodejs";

type EngineStatus = {
  configured: boolean;
  label: string;
  detail: string;
  mode?: "server" | "browser";
};

function openAiStatus(): EngineStatus {
  const configured = isOpenAiConfigured();
  const model = getOpenAiModel();
  return {
    configured,
    label: "OpenAI",
    mode: "server",
    detail: configured
      ? `설정됨 · 모델 ${model}`
      : "미설정 · OPENAI_API_KEY 필요",
  };
}

function ollamaStatus(): EngineStatus {
  const defaults = getLocalEngineDefaultsFromEnv();
  return {
    configured: true,
    label: "Ollama",
    mode: "browser",
    detail:
      `브라우저에서 사용자 PC의 로컬 Ollama를 호출합니다 · 기본 ${defaults.ollamaBaseUrl} / ${defaults.ollamaModel}. ` +
      `OLLAMA_ORIGINS에 이 앱 Origin을 허용하고 설정에서 연결 테스트를 실행하세요.`,
  };
}

export async function GET() {
  const defaults = getLocalEngineDefaultsFromEnv();
  const defaultProvider = getLlmProvider();
  return NextResponse.json({
    defaultProvider,
    defaultLabel: llmProviderLabel(defaultProvider),
    ollamaModel: defaults.ollamaModel || getOllamaModel(),
    openaiModel: getOpenAiModel(),
    engines: {
      openai: openAiStatus(),
      ollama: ollamaStatus(),
    },
    defaults,
  });
}
