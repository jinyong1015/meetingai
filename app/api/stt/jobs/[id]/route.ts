import { NextResponse } from "next/server";
import { createSttAdapter, isProviderConfigured, isSttProvider } from "@/lib/stt";
import type { SttProvider } from "@/lib/stt/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const jobId = id?.trim();
    if (!jobId) {
      return NextResponse.json(
        { error: "전사 작업 ID가 필요합니다." },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const rawProvider = searchParams.get("provider");
    const provider: SttProvider =
      rawProvider && isSttProvider(rawProvider) ? rawProvider : "assemblyai";

    if (provider !== "assemblyai") {
      return NextResponse.json(
        {
          error:
            "원격 작업 재조회는 AssemblyAI만 지원합니다. Whisper는 로컬 동기 전사입니다.",
        },
        { status: 400 },
      );
    }

    if (!isProviderConfigured(provider)) {
      return NextResponse.json(
        { error: "ASSEMBLYAI_API_KEY가 설정되지 않았습니다." },
        { status: 400 },
      );
    }

    const adapter = createSttAdapter(provider);
    if (!adapter.getJob) {
      return NextResponse.json(
        { error: "이 엔진은 작업 재조회를 지원하지 않습니다." },
        { status: 400 },
      );
    }

    const result = await adapter.getJob(jobId);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "전사 작업 조회에 실패했습니다.";
    console.error("[stt/jobs]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
