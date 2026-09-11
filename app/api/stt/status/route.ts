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

function whisperStatus(): EngineStatus {
  const configured = Boolean(process.env.WHISPER_API_URL?.trim());
  return {
    configured,
    label: "Whisper",
    detail: configured
      ? "로컬 사용 가능 · WHISPER_API_URL 확인됨"
      : "미설정 · WHISPER_API_URL 필요",
  };
}

export async function GET() {
  const assemblyai = assemblyStatus();
  const whisper = whisperStatus();
  return NextResponse.json({
    defaultProvider: getSttProvider(),
    engines: {
      assemblyai,
      whisper,
    },
  });
}
