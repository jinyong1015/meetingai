import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type SendWebhookBody = {
  eventId?: string;
  meeting?: {
    id?: string;
    title?: string;
    startedAt?: string;
    attendees?: string;
    approvedVersion?: number | null;
  };
  markdown?: string;
  memoMarkdown?: string;
  summaryMarkdown?: string;
  minutesMarkdown?: string;
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

  let body: SendWebhookBody;
  try {
    body = (await request.json()) as SendWebhookBody;
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바른 JSON이 아닙니다." },
      { status: 400 },
    );
  }

  const markdown =
    typeof body.markdown === "string" ? body.markdown.trim() : "";
  if (!markdown) {
    return NextResponse.json(
      { error: "전송할 마크다운 본문이 비어 있습니다." },
      { status: 400 },
    );
  }

  const eventId =
    typeof body.eventId === "string" && body.eventId.trim()
      ? body.eventId.trim()
      : `evt_${crypto.randomUUID()}`;

  const payload = {
    schema_version: "1.0",
    event_id: eventId,
    event_type: "meeting.approved",
    occurred_at: new Date().toISOString(),
    meeting: {
      id: body.meeting?.id ?? null,
      title: body.meeting?.title ?? null,
      started_at: body.meeting?.startedAt ?? null,
      attendees: body.meeting?.attendees ?? null,
      approved_version: body.meeting?.approvedVersion ?? null,
    },
    content: {
      format: "markdown",
      markdown,
      memo_markdown:
        typeof body.memoMarkdown === "string" ? body.memoMarkdown : "",
      summary_markdown:
        typeof body.summaryMarkdown === "string" ? body.summaryMarkdown : "",
      minutes_markdown:
        typeof body.minutesMarkdown === "string" ? body.minutesMarkdown : "",
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json(
        {
          error: "웹훅 수신처가 리다이렉트를 반환했습니다. 주소를 확인해 주세요.",
          status: response.status,
        },
        { status: 502 },
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: `웹훅 전송 실패 (HTTP ${response.status})`,
          status: response.status,
          detail: detail.slice(0, 500),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      eventId,
      status: response.status,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "웹훅 응답 시간이 초과되었습니다."
        : err instanceof Error
          ? err.message
          : "웹훅 전송 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
