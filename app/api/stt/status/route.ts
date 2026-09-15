import { NextResponse } from "next/server";
import { getSttProvider } from "@/lib/stt";
import { getLocalEngineDefaultsFromEnv } from "@/lib/localEngines/defaults";

export const runtime = "nodejs";

type EngineStatus = {
  configured: boolean;
  label: string;
  detail: string;
  mode?: "server" | "browser";
};

function assemblyStatus(): EngineStatus {
  const configured = Boolean(process.env.ASSEMBLYAI_API_KEY?.trim());
  return {
    configured,
    label: "AssemblyAI",
    mode: "server",
    detail: configured
      ? "설정됨 · 서버 환경변수 확인됨"
      : "미설정 · ASSEMBLYAI_API_KEY 필요",
  };
}

function whisperStatus(): EngineStatus {
  const defaults = getLocalEngineDefaultsFromEnv();
  return {
    configured: true,
    label: "Whisper",
    mode: "browser",
    detail:
      `브라우저에서 사용자 PC의 로컬 Whisper를 호출합니다 · 기본 ${defaults.whisperApiUrl}. ` +
      `설정 화면에서 URL을 확인하고 연결 테스트를 실행하세요.`,
  };
}

export async function GET() {
  return NextResponse.json({
    defaultProvider: getSttProvider(),
    engines: {
      assemblyai: assemblyStatus(),
      whisper: whisperStatus(),
    },
    defaults: getLocalEngineDefaultsFromEnv(),
  });
}
