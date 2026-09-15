import type { EvidenceRef } from "@/lib/types/evidence";

/** Structured detailed meeting minutes matching SCR-04 detail layout. */

export type DetailDiscussionItem = {
  speaker: string | null;
  content: string;
};

export type DetailDecisionItem = {
  text: string;
  evidence?: EvidenceRef | null;
  /** Marked as needing user confirmation (conflicting / uncertain). */
  needsReview?: boolean;
};

export type DetailActionItem = {
  task: string;
  owner: string | null;
  due: string | null;
  evidence?: EvidenceRef | null;
  needsReview?: boolean;
};

export type DetailAgendaItem = {
  title: string;
  discussions: DetailDiscussionItem[];
  decisions: DetailDecisionItem[];
  actionItems: DetailActionItem[];
};

export type MeetingDetailMinutes = {
  /** Document headline, e.g. "2024년 마케팅 전략회의" */
  documentTitle: string;
  meetingTitle: string;
  datetime: string;
  location: string;
  attendees: string[];
  host: string;
  purpose: string;
  agendas: DetailAgendaItem[];
  nextMeeting: string | null;
  additionalItems: string[];
};

export function decisionText(item: DetailDecisionItem | string): string {
  return typeof item === "string" ? item : item.text;
}

export function formatDetailMinutesText(
  detail: MeetingDetailMinutes,
): string {
  const lines: string[] = [];

  lines.push(detail.documentTitle);
  lines.push("");
  lines.push(`회의 제목: ${detail.meetingTitle}`);
  lines.push(`회의 일시: ${detail.datetime}`);
  lines.push(`장소: ${detail.location}`);
  lines.push(`참석자: ${detail.attendees.join(", ")}`);
  lines.push(`주최자: ${detail.host}`);
  lines.push(`회의 목적: ${detail.purpose}`);
  lines.push("");

  detail.agendas.forEach((agenda, index) => {
    lines.push(`안건 ${index + 1}: ${agenda.title}`);
    lines.push("논의 내용:");
    agenda.discussions.forEach((item) => {
      lines.push(`- ${item.content}`);
    });
    if (agenda.decisions.length) {
      lines.push("결정 사항:");
      agenda.decisions.forEach((item) => lines.push(`- ${decisionText(item)}`));
    }
    if (agenda.actionItems.length) {
      lines.push("액션 아이템:");
      agenda.actionItems.forEach((item) => {
        const due = item.due ?? "미정";
        lines.push(`- ${item.task} (${due})`);
      });
    }
    lines.push("");
  });

  if (detail.nextMeeting) {
    lines.push(`다음 회의 일정: ${detail.nextMeeting}`);
  }
  if (detail.additionalItems.length) {
    lines.push("추가 논의 사항:");
    detail.additionalItems.forEach((item) => lines.push(`- ${item}`));
  }

  return lines.join("\n").trim();
}

/** Count items explicitly marked as needing review. */
export function countNeedsReview(detail: MeetingDetailMinutes | null): number {
  if (!detail) return 0;
  let count = 0;
  for (const agenda of detail.agendas) {
    for (const decision of agenda.decisions) {
      if (decision.needsReview) count += 1;
    }
    for (const action of agenda.actionItems) {
      if (action.needsReview) count += 1;
    }
  }
  return count;
}
