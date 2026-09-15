import {
  decisionText,
  type MeetingDetailMinutes,
} from "@/lib/types/detail";
import type { Note } from "@/lib/types/note";
import type { TranscriptSegment } from "@/lib/types/transcript";
import type { WebhookIncludeFlags } from "@/lib/types/webhook";
import { formatTimestamp } from "@/lib/utils/format-time";

export type BuildWebhookPayloadInput = {
  eventId: string;
  occurredAt?: string;
  meeting: {
    id: string;
    title: string;
    startedAt: string;
    timezone?: string;
    attendees?: string;
    approvedVersion: number | null;
  };
  includeFlags: WebhookIncludeFlags;
  notes: Note[];
  summaryText: string | null;
  detailMinutes: MeetingDetailMinutes | null;
  detailText?: string | null;
  segments?: TranscriptSegment[];
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

function formatTranscriptMarkdown(segments: TranscriptSegment[]): string {
  if (segments.length === 0) return "(전사문 없음)";
  return segments
    .map((segment) => {
      const time = `[${formatTimestamp(segment.startedAtSec)}]`;
      const speaker = segment.speakerLabel ? `${segment.speakerLabel} ` : "";
      return `${time} ${speaker}${segment.text}`;
    })
    .join("\n");
}

function extractActionItems(detail: MeetingDetailMinutes | null) {
  if (!detail) return [];
  return detail.agendas.flatMap((agenda) =>
    agenda.actionItems.map((item) => ({
      task: item.task,
      owner: item.owner || null,
      due_date: item.due || null,
      needs_review: Boolean(item.needsReview),
      agenda: agenda.title,
    })),
  );
}

function formatMinutesMarkdown(
  detail: MeetingDetailMinutes | null,
  detailText?: string | null,
  includeActionItems = true,
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
      if (includeActionItems) {
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

/** Builds the immutable webhook JSON body for a confirmed meeting send. */
export function buildWebhookPayload(
  input: BuildWebhookPayloadInput,
): Record<string, unknown> {
  const flags = input.includeFlags;
  const content: Record<string, unknown> = {
    format: "markdown",
  };

  if (flags.summary) {
    content.summary = input.summaryText?.trim() || "";
    content.summary_markdown = input.summaryText?.trim() || "(요약 없음)";
  }

  if (flags.actionItems) {
    content.action_items = extractActionItems(input.detailMinutes);
  }

  if (flags.detail) {
    const minutesMarkdown = formatMinutesMarkdown(
      input.detailMinutes,
      input.detailText,
      flags.actionItems,
    );
    content.minutes_markdown = minutesMarkdown;
    content.detail = minutesMarkdown;
  }

  if (flags.notes) {
    content.memo_markdown = formatNotesMarkdown(input.notes);
  }

  if (flags.transcript) {
    content.transcript_markdown = formatTranscriptMarkdown(
      input.segments ?? [],
    );
  }

  const markdownSections: string[] = [`# ${input.meeting.title}`, ""];
  if (flags.notes) {
    markdownSections.push("## 메모", "", String(content.memo_markdown), "");
  }
  if (flags.summary) {
    markdownSections.push(
      "## 요약",
      "",
      String(content.summary_markdown),
      "",
    );
  }
  if (flags.detail) {
    markdownSections.push(
      "## 회의록",
      "",
      String(content.minutes_markdown),
      "",
    );
  }
  if (flags.transcript) {
    markdownSections.push(
      "## 전사문",
      "",
      String(content.transcript_markdown),
      "",
    );
  }
  content.markdown = markdownSections.join("\n");

  const meeting: Record<string, unknown> = {
    id: input.meeting.id,
    title: input.meeting.title,
    approved_version: input.meeting.approvedVersion,
  };
  if (flags.meetingInfo) {
    meeting.started_at = input.meeting.startedAt;
    meeting.timezone = input.meeting.timezone ?? null;
    meeting.attendees = input.meeting.attendees ?? null;
  }

  return {
    schema_version: "1.0",
    event_id: input.eventId,
    event_type: "meeting.approved",
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    meeting,
    content,
    include: {
      meeting_info: flags.meetingInfo,
      summary: flags.summary,
      detail: flags.detail,
      action_items: flags.actionItems,
      transcript: flags.transcript,
      notes: flags.notes,
      audio: false,
    },
  };
}

export function buildWebhookTestPayload(destinationAlias: string): {
  payload: Record<string, unknown>;
  eventId: string;
} {
  const eventId = `evt_test_${crypto.randomUUID()}`;
  return {
    eventId,
    payload: {
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
    },
  };
}

/** @deprecated Prefer buildWebhookPayload for SCR-06 include flags. */
export {
  buildWebhookMarkdownPayload,
  type BuildWebhookMarkdownInput,
  type WebhookMarkdownParts,
} from "@/lib/webhook/buildMarkdownPayload";
