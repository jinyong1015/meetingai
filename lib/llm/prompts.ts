import type { LlmGenerateInput } from "@/lib/llm/types";

/** Fixed system rules the user cannot remove (PRD §2.5). */
export const LLM_SYSTEM_RULES = `당신은 한국어 업무 회의록 작성 도우미입니다.
반드시 제공된 전사문과 메모에만 근거하세요.
원문에 없는 사실·발언·결정·담당자·기한을 추측하거나 확정적으로 쓰지 마세요.
제안과 합의를 구분하고, 불확실하면 미정 또는 확인 필요로 표시하세요.
출력은 요청한 JSON 스키마만 따르세요.`;

export const DEFAULT_SUMMARY_USER_PROMPT = `이 회의의 핵심 내용을 한국어 업무 보고 문체로 요약하세요.
회의 목적, 주요 논의, 결정사항, 후속 업무를 구분하세요.
중복 내용을 합치고 핵심 항목은 최대 7개로 정리하세요.
결정되지 않은 내용은 결정사항으로 표현하지 마세요.
담당자와 기한이 명시되지 않았다면 미정으로 남기세요.`;

export const DEFAULT_DETAIL_USER_PROMPT = `회의 내용을 안건별 상세 회의록으로 작성하세요.
각 안건은 논의 배경, 주요 의견, 결론, 미결 사항으로 구분하세요.
제안된 내용과 최종 합의된 내용을 명확히 구분하세요.
후속 업무는 업무 내용, 담당자, 기한으로 정리하세요.
발언과 메모가 충돌하면 확인 필요 사항으로 표시하세요.
원문에 없는 사실이나 발언을 추가하지 마세요.
참석자·주최자·장소·일시가 입력에 없으면 빈 문자열 또는 빈 배열로 두세요.
액션 아이템의 owner는 원문에 명시된 경우에만 채우고, 없으면 null로 두세요.`;

function formatNotes(notes: LlmGenerateInput["notes"]): string {
  if (notes.length === 0) return "(선택된 메모 없음)";
  return notes
    .map((note, index) => {
      const time =
        note.timestampSec != null
          ? `[${Math.floor(note.timestampSec / 60)}:${String(Math.floor(note.timestampSec % 60)).padStart(2, "0")}] `
          : "";
      const flag = note.important ? "[중요] " : "";
      return `${index + 1}. ${time}${flag}${note.content}`;
    })
    .join("\n");
}

export function buildMeetingContextBlock(input: LlmGenerateInput): string {
  const tags =
    input.meeting.tags.length > 0
      ? input.meeting.tags.join(", ")
      : "(없음)";
  return [
    `회의 제목: ${input.meeting.title || "(제목 없음)"}`,
    `회의 일시: ${input.meeting.startedAt || "(미정)"}`,
    `참석자: ${input.meeting.attendees || "(미정)"}`,
    `태그: ${tags}`,
    "",
    "## 전사문",
    input.transcript.trim() || "(전사문 없음)",
    "",
    "## AI 반영 메모",
    formatNotes(input.notes),
  ].join("\n");
}

export function buildSummaryMessages(input: LlmGenerateInput) {
  return [
    { role: "system" as const, content: LLM_SYSTEM_RULES },
    {
      role: "user" as const,
      content: [
        DEFAULT_SUMMARY_USER_PROMPT,
        "",
        buildMeetingContextBlock(input),
        "",
        'JSON의 summaryText 필드에 요약 본문만 넣으세요. 마크다운 제목(#, ##)은 쓰지 마세요.',
      ].join("\n"),
    },
  ];
}

export function buildDetailMessages(input: LlmGenerateInput) {
  return [
    { role: "system" as const, content: LLM_SYSTEM_RULES },
    {
      role: "user" as const,
      content: [
        DEFAULT_DETAIL_USER_PROMPT,
        "",
        buildMeetingContextBlock(input),
        "",
        "회의 메타데이터(제목·일시·참석자)가 입력에 있으면 해당 필드를 채우세요.",
        "documentTitle은 문서 제목으로 쓰기 좋은 짧은 제목으로 하세요.",
      ].join("\n"),
    },
  ];
}
