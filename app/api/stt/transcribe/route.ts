import { NextResponse } from "next/server";
import {
  createSttAdapter,
  getSttProvider,
  isProviderConfigured,
  isSttProvider,
} from "@/lib/stt";
import type { SttProvider } from "@/lib/stt/types";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024; // PRD: AI upload max 200 MiB

function resolveProvider(raw: FormDataEntryValue | null): SttProvider {
  if (typeof raw === "string" && isSttProvider(raw)) return raw;
  return getSttProvider();
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("audio");
    const language =
      typeof form.get("language") === "string"
        ? String(form.get("language"))
        : "ko";
    const provider = resolveProvider(form.get("provider"));

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

    if (provider === "whisper") {
      return NextResponse.json(
        {
          error:
            "로컬 Whisper는 브라우저에서 직접 호출합니다. /api/stt/transcribe 대신 설정에 등록된 Whisper URL로 전송하세요.",
        },
        { status: 410 },
      );
    }

    if (!isProviderConfigured(provider)) {
      return NextResponse.json(
        { error: "ASSEMBLYAI_API_KEY가 설정되지 않았습니다." },
        { status: 400 },
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const adapter = createSttAdapter(provider);
    const result = await adapter.transcribe({
      audio: buffer,
      mimeType: file.type || "audio/wav",
      language,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "음성 인식에 실패했습니다.";
    console.error("[stt/transcribe]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({
    provider: getSttProvider(),
    configured: Boolean(
      process.env.ASSEMBLYAI_API_KEY?.trim() ||
        process.env.WHISPER_API_URL?.trim(),
    ),
  });
}
