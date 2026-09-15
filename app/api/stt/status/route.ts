import { NextResponse } from "next/server";
import { getSttProvider } from "@/lib/stt";

export const runtime = "nodejs";

type EngineStatus = {
  configured: boolean;
  label: string;
  detail: string;
};

function assemblyStatus(): EngineStatus {
  const configured = Boolean(process.env.ASSEMBLYAI_API_KEY?.trim());
  return {
    configured,
    label: "AssemblyAI",
    detail: configured
      ? "설정됨 · 서버 환경변수 확인됨"
      : "미설정 · ASSEMBLYAI_API_KEY 필요",
  };
}

async function whisperStatus(): Promise<EngineStatus> {
  const endpoint = process.env.WHISPER_API_URL?.trim();
  if (!endpoint) {
    return {
      configured: false,
      label: "Whisper",
      detail: "미설정 · WHISPER_API_URL 필요",
    };
  }

  try {
    const healthUrl = endpoint.replace(
      /\/v1\/audio\/transcriptions\/?$/i,
      "/health",
    );
    const res = await fetch(healthUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      return {
        configured: true,
        label: "Whisper",
        detail: `URL 설정됨 · 서버 응답 ${res.status}`,
      };
    }
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      model?: string;
    } | null;
    if (data?.ok) {
      return {
        configured: true,
        label: "Whisper",
        detail: data.model
          ? `연결됨 · 모델 ${data.model}`
          : "연결됨 · /health OK",
      };
    }
    return {
      configured: true,
      label: "Whisper",
      detail: "URL 설정됨 · health 응답 확인 필요",
    };
  } catch {
    return {
      configured: true,
      label: "Whisper",
      detail: "URL 설정됨 · 서버 미실행 또는 연결 실패",
    };
  }
}

export async function GET() {
  const [assemblyai, whisper] = await Promise.all([
    Promise.resolve(assemblyStatus()),
    whisperStatus(),
  ]);
  return NextResponse.json({
    defaultProvider: getSttProvider(),
    engines: {
      assemblyai,
      whisper,
    },
  });
}
