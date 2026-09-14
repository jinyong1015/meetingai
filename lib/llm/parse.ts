import type { MeetingDetailMinutes } from "@/lib/types/detail";

export function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("모델이 빈 응답을 반환했습니다.");
  }

  // Some local models wrap JSON in markdown fences.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as unknown;
      } catch {
        // fall through
      }
    }
    throw new Error("모델 응답을 JSON으로 해석하지 못했습니다.");
  }
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return null;
}

export function normalizeDetail(raw: unknown): MeetingDetailMinutes {
  if (!raw || typeof raw !== "object") {
    throw new Error("상세 회의록 형식이 올바르지 않습니다.");
  }
  const obj = raw as Record<string, unknown>;
  const agendasRaw = Array.isArray(obj.agendas) ? obj.agendas : [];

  return {
    documentTitle: asString(obj.documentTitle),
    meetingTitle: asString(obj.meetingTitle),
    datetime: asString(obj.datetime),
    location: asString(obj.location),
    attendees: asStringArray(obj.attendees),
    host: asString(obj.host),
    purpose: asString(obj.purpose),
    agendas: agendasRaw.map((agenda) => {
      const item =
        agenda && typeof agenda === "object"
          ? (agenda as Record<string, unknown>)
          : {};
      const discussions = Array.isArray(item.discussions)
        ? item.discussions
        : [];
      const actionItems = Array.isArray(item.actionItems)
        ? item.actionItems
        : [];
      return {
        title: asString(item.title, "안건"),
        discussions: discussions.map((d) => {
          const row =
            d && typeof d === "object" ? (d as Record<string, unknown>) : {};
          return {
            speaker: asNullableString(row.speaker),
            content: asString(row.content),
          };
        }),
        decisions: asStringArray(item.decisions),
        actionItems: actionItems.map((a) => {
          const row =
            a && typeof a === "object" ? (a as Record<string, unknown>) : {};
          return {
            task: asString(row.task),
            owner: asNullableString(row.owner),
            due: asNullableString(row.due),
          };
        }),
      };
    }),
    nextMeeting: asNullableString(obj.nextMeeting),
    additionalItems: asStringArray(obj.additionalItems),
  };
}
