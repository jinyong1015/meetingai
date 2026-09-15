import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type TestBody = {
  destinationAlias?: string;
  payload?: Record<string, unknown>;
};

function getWebhookUrl(): string | null {
  const url = process.env.MAKE_WEBHOOK_URL?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return NextResponse.json(
      {
        error:
          "MAKE_WEBHOOK_URL이 설정되지 않았습니다. .env.local에 Make 웹훅 주소를 추가한 뒤 서버를 다시 시작해 주세요.",
      },
      { status: 503 },
    );
  }

  let body: TestBody = {};
  try {
    body = (await request.json()) as TestBody;
  } catch {
    body = {};
  }

  const eventId = `evt_test_${crypto.randomUUID()}`;
  const destinationAlias =
    typeof body.destinationAlias === "string" && body.destinationAlias.trim()
      ? body.destinationAlias.trim()
      : "사내 업무관리 시스템";

  const payload =
    body.payload && typeof body.payload === "object"
      ? body.payload
      : {
          schema_version: "1.0",
          event_id: eventId,
          event_type: "meeting.webhook.test",
          occurred_at: new Date().toISOString(),
          destination_alias: destinationAlias,
          meeting: {
            id: "meeting_sample",
            title: "웹훅 시험 발송 (샘플)",
            approved_version: 0,
          },
          content: {
            format: "markdown",
            summary: "이것은 실제 회의 데이터가 아닌 시험 발송 샘플입니다.",
            markdown:
              "# 웹훅 시험 발송 (샘플)\n\n실제 회의 내용은 포함되지 않습니다.\n",
          },
          sample: true,
        };

  const outbound = {
    ...payload,
    event_id:
      typeof payload.event_id === "string" && payload.event_id
        ? payload.event_id
        : eventId,
    sample: true,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const started = Date.now();

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(outbound),
      signal: controller.signal,
      redirect: "manual",
    });

    const responseTimeMs = Date.now() - started;

    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json(
        {
          ok: false,
          error: "웹훅 수신처가 리다이렉트를 반환했습니다. 주소를 확인해 주세요.",
          status: response.status,
          responseTimeMs,
        },
        { status: 502 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `연결하지 못했습니다. HTTP ${response.status}`,
          status: response.status,
          responseTimeMs,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "연결에 성공했습니다.",
      status: response.status,
      responseTimeMs,
      eventId: outbound.event_id,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "웹훅 응답 시간이 초과되었습니다."
        : err instanceof Error
          ? err.message
          : "시험 발송 중 오류가 발생했습니다.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        responseTimeMs: Date.now() - started,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
