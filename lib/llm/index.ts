import { OpenAiLlmAdapter, getOpenAiModel, isOpenAiConfigured } from "./openai";
import {
  OllamaLlmAdapter,
  getOllamaBaseUrl,
  getOllamaModel,
  isOllamaConfigured,
  probeOllama,
  generateSummaryWithOllama,
  generateDetailWithOllama,
} from "./ollama";
import type { LlmAdapter, LlmProvider } from "./types";

export type {
  LlmAdapter,
  LlmGenerateInput,
  LlmNoteInput,
  LlmProvider,
} from "./types";
export {
  getOpenAiModel,
  isOpenAiConfigured,
  getOllamaBaseUrl,
  getOllamaModel,
  isOllamaConfigured,
  probeOllama,
  generateSummaryWithOllama,
  generateDetailWithOllama,
};

export function isLlmProvider(value: unknown): value is LlmProvider {
  return value === "openai" || value === "ollama";
}

export function getLlmProvider(): LlmProvider {
  const raw = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (raw === "ollama") return "ollama";
  if (raw === "openai") return "openai";
  if (isOpenAiConfigured()) return "openai";
  return "ollama";
}

export function isLlmProviderConfigured(provider: LlmProvider): boolean {
  if (provider === "openai") return isOpenAiConfigured();
  return isOllamaConfigured();
}

export function createLlmAdapter(provider = getLlmProvider()): LlmAdapter {
  if (provider === "openai") {
    if (!isOpenAiConfigured()) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }
    return new OpenAiLlmAdapter();
  }
  if (!isOllamaConfigured()) {
    throw new Error("OLLAMA_BASE_URL이 설정되지 않았습니다.");
  }
  return new OllamaLlmAdapter();
}

export function llmProviderLabel(provider: LlmProvider): string {
  if (provider === "ollama") return "Ollama";
  return "OpenAI";
}
