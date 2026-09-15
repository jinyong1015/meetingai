import { NextResponse } from "next/server";
import {
  createSttAdapter,
  isProviderConfigured,
  isSttProvider,
} from "@/lib/stt";
import type { SttProvider } from "@/lib/stt/types";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024;

function resolveProvider(raw: FormDataEntryValue | null): SttProvider {
  if (typeof raw === "string" && isSttProvider(raw)) return raw;
  return "assemblyai";
}

/** Start an async STT job (AssemblyAI). Returns remoteJobId for AI-05 polling. */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("audio");
    const language =
      typeof form.get("language") === "string"
        ? String(form.get("language"))
        : "ko";
    const provider = resolveProvider(form.get("provider"));

    if (provider !== "assemblyai") {
      return NextResponse.json(
        {
          error:
            "비동기 작업 시작은 AssemblyAI만 지원합니다. Whisper는 /api/stt/transcribe를 사용하세요.",
        },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "audio 파일이 필요합니다." },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "빈 오디오 조각입니다." },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "오디오 파일이 너무 큽니다. (최대 200MiB)" },
        { status: 413 },
      );
    }

    if (!isProviderConfigured(provider)) {
      return NextResponse.json(
        { error: "ASSEMBLYAI_API_KEY가 설정되지 않았습니다." },
        { status: 400 },
      );
    }

    const adapter = createSttAdapter(provider);
    if (!adapter.startJob) {
      return NextResponse.json(
        { error: "이 엔진은 비동기 작업 시작을 지원하지 않습니다." },
        { status: 400 },
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const started = await adapter.startJob({
      audio: buffer,
      mimeType: file.type || "audio/wav",
      language,
    });

    return NextResponse.json(started);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "전사 작업 시작에 실패했습니다.";
    console.error("[stt/jobs]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
