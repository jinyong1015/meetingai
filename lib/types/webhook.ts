export type WebhookDeliveryStatus =
  | "queued"
  | "sending"
  | "succeeded"
  | "retry_wait"
  | "failed"
  | "cancelled";

export type WebhookIncludeFlags = {
  meetingInfo: boolean;
  summary: boolean;
  detail: boolean;
  actionItems: boolean;
  transcript: boolean;
  notes: boolean;
};

export const DEFAULT_WEBHOOK_INCLUDE_FLAGS: WebhookIncludeFlags = {
  meetingInfo: false,
  summary: false,
  detail: true,
  actionItems: false,
  transcript: false,
  notes: false,
};

export const DEFAULT_WEBHOOK_DESTINATION_ALIAS = "사내 업무관리 시스템";

export const WEBHOOK_MAX_ATTEMPTS = 4;

/** Delay after attempt N failure before attempt N+1 (ms). Index 0 = after 1st fail. */
export const WEBHOOK_RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
] as const;

export type WebhookDeliveryAttempt = {
  attemptNumber: number;
  startedAt: string;
  finishedAt: string;
  httpStatus: number | null;
  ok: boolean;
  errorMessage: string | null;
  responseTimeMs: number | null;
};

export type WebhookDelivery = {
  id: string;
  eventId: string;
  meetingId: string;
  approvedVersion: number;
  destinationAlias: string;
  includeFlags: WebhookIncludeFlags;
  /** Immutable JSON body posted to the webhook. */
  payloadSnapshot: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
  attempts: WebhookDeliveryAttempt[];
  lastHttpStatus: number | null;
  lastError: string | null;
};

export function webhookStatusLabel(status: WebhookDeliveryStatus): string {
  switch (status) {
    case "queued":
      return "전송 대기";
    case "sending":
      return "전송 중";
    case "succeeded":
      return "전송 완료";
    case "retry_wait":
      return "재시도 대기";
    case "failed":
      return "전송 실패";
    case "cancelled":
      return "취소됨";
  }
}

export function canCancelWebhookDelivery(status: WebhookDeliveryStatus): boolean {
  return status === "queued" || status === "retry_wait";
}

export function canRetryWebhookDelivery(status: WebhookDeliveryStatus): boolean {
  return status === "failed";
}

export function includeFlagsFromSettings(input: {
  webhookIncludeMeetingInfo: boolean;
  webhookIncludeSummary: boolean;
  webhookIncludeDetail: boolean;
  webhookIncludeActionItems: boolean;
  webhookIncludeTranscript: boolean;
  webhookIncludeNotes: boolean;
}): WebhookIncludeFlags {
  return {
    meetingInfo: input.webhookIncludeMeetingInfo,
    summary: input.webhookIncludeSummary,
    detail: input.webhookIncludeDetail,
    actionItems: input.webhookIncludeActionItems,
    transcript: input.webhookIncludeTranscript,
    notes: input.webhookIncludeNotes,
  };
}

export function describeIncludeFlags(flags: WebhookIncludeFlags): {
  included: string[];
  excluded: string[];
} {
  const labels: Array<{ key: keyof WebhookIncludeFlags; label: string }> = [
    { key: "meetingInfo", label: "회의 정보" },
    { key: "summary", label: "요약" },
    { key: "detail", label: "상세 회의록" },
    { key: "actionItems", label: "후속 업무" },
    { key: "transcript", label: "전사문" },
    { key: "notes", label: "메모" },
  ];
  const included: string[] = [];
  const excluded: string[] = [];
  for (const item of labels) {
    if (flags[item.key]) included.push(item.label);
    else excluded.push(item.label);
  }
  return { included, excluded };
}
