import {
  decisionText,
  type MeetingDetailMinutes,
} from "@/lib/types/detail";
import type { Note } from "@/lib/types/note";
import { formatTimestamp } from "@/lib/utils/format-time";

export type WebhookMarkdownParts = {
  memoMarkdown: string;
  summaryMarkdown: string;
  minutesMarkdown: string;
  /** Full document combining memo + summary + minutes. */
  markdown: string;
};

export type BuildWebhookMarkdownInput = {
  title: string;
  notes: Note[];
  summaryText: string | null;
  detailMinutes: MeetingDetailMinutes | null;
  detailText?: string | null;
};

function formatNotesMarkdown(notes: Note[]): string {
  if (notes.length === 0) return "(메모 없음)";

  return notes
    .map((note) => {
      const time =
        note.timestampSec != null
          ? `[${formatTimestamp(note.timestampSec)}] `
          : "";
      const badges: string[] = [];
      if (note.important) badges.push("중요");
      if (!note.includeInAI) badges.push("AI 제외");
      const badgeText = badges.length > 0 ? ` (${badges.join(", ")})` : "";
      return `- ${time}${note.content.trim()}${badgeText}`;
    })
    .join("\n");
}

function formatMinutesMarkdown(
  detail: MeetingDetailMinutes | null,
  detailText?: string | null,
): string {
  if (detail) {
    const lines: string[] = [];
    lines.push(`### ${detail.documentTitle || detail.meetingTitle}`);
    lines.push("");
    lines.push(`- **회의 제목:** ${detail.meetingTitle}`);
    lines.push(`- **회의 일시:** ${detail.datetime}`);
    lines.push(`- **장소:** ${detail.location}`);
    lines.push(`- **참석자:** ${detail.attendees.join(", ") || "없음"}`);
    lines.push(`- **주최자:** ${detail.host || "없음"}`);
    lines.push(`- **회의 목적:** ${detail.purpose || "없음"}`);
    lines.push("");

    detail.agendas.forEach((agenda, index) => {
      lines.push(`### 안건 ${index + 1}. ${agenda.title}`);
      lines.push("");
      lines.push("#### 논의 내용");
      if (agenda.discussions.length === 0) {
        lines.push("- (없음)");
      } else {
        agenda.discussions.forEach((item) => {
          const speaker = item.speaker ? `**${item.speaker}:** ` : "";
          lines.push(`- ${speaker}${item.content}`);
        });
      }
      lines.push("");
      lines.push("#### 결정 사항");
      if (agenda.decisions.length === 0) {
        lines.push("- (없음)");
      } else {
        agenda.decisions.forEach((item) => {
          const review = item.needsReview ? " ⚠️ 확인 필요" : "";
          lines.push(`- ${decisionText(item)}${review}`);
        });
      }
      lines.push("");
      lines.push("#### 액션 아이템");
      if (agenda.actionItems.length === 0) {
        lines.push("- (없음)");
      } else {
        agenda.actionItems.forEach((item) => {
          const owner = item.owner ? ` · 담당: ${item.owner}` : "";
          const due = item.due ? ` · 기한: ${item.due}` : " · 기한: 미정";
          const review = item.needsReview ? " ⚠️ 확인 필요" : "";
          lines.push(`- ${item.task}${owner}${due}${review}`);
        });
      }
      lines.push("");
    });

    if (detail.nextMeeting) {
      lines.push(`### 다음 회의`);
      lines.push("");
      lines.push(detail.nextMeeting);
      lines.push("");
    }

    if (detail.additionalItems.length > 0) {
      lines.push("### 기타");
      lines.push("");
      detail.additionalItems.forEach((item) => lines.push(`- ${item}`));
    }

    return lines.join("\n").trim();
  }

  const flat = detailText?.trim();
  return flat || "(회의록 없음)";
}

export function buildWebhookMarkdownPayload(
  input: BuildWebhookMarkdownInput,
): WebhookMarkdownParts {
  const memoMarkdown = formatNotesMarkdown(input.notes);
  const summaryMarkdown = input.summaryText?.trim() || "(요약 없음)";
  const minutesMarkdown = formatMinutesMarkdown(
    input.detailMinutes,
    input.detailText,
  );

  const markdown = [
    `# ${input.title}`,
    "",
    "## 메모",
    "",
    memoMarkdown,
    "",
    "## 요약",
    "",
    summaryMarkdown,
    "",
    "## 회의록",
    "",
    minutesMarkdown,
    "",
  ].join("\n");

  return {
    memoMarkdown,
    summaryMarkdown,
    minutesMarkdown,
    markdown,
  };
}
