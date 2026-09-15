import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isWebhookConfigured(): boolean {
  const url = process.env.MAKE_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function GET() {
  const configured = isWebhookConfigured();
  return NextResponse.json({
    configured,
    label: "Make 웹훅",
    detail: configured
      ? "서버에 MAKE_WEBHOOK_URL이 설정되어 있습니다. URL·비밀키는 화면에 표시되지 않습니다."
      : "MAKE_WEBHOOK_URL이 설정되지 않았습니다. .env.local에 주소를 추가한 뒤 서버를 다시 시작해 주세요.",
    destinationCount: configured ? 1 : 0,
  });
}
