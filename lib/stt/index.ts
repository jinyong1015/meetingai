import { AssemblyAiSttAdapter } from "./assemblyai";
import type { SttAdapter, SttProvider } from "./types";
import { WhisperSttAdapter } from "./whisper";

export function isSttProvider(value: unknown): value is SttProvider {
  return value === "assemblyai" || value === "whisper";
}

export function getSttProvider(): SttProvider {
  const raw = process.env.STT_PROVIDER?.trim().toLowerCase();
  if (raw === "whisper") return "whisper";
  return "assemblyai";
}

export function createSttAdapter(provider = getSttProvider()): SttAdapter {
  if (provider === "whisper") return new WhisperSttAdapter();
  return new AssemblyAiSttAdapter();
}

export function isProviderConfigured(provider: SttProvider): boolean {
  if (provider === "whisper") {
    return Boolean(process.env.WHISPER_API_URL?.trim());
  }
  return Boolean(process.env.ASSEMBLYAI_API_KEY?.trim());
}
