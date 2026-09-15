import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_MS,
  type WebhookDelivery,
  type WebhookDeliveryAttempt,
  type WebhookIncludeFlags,
} from "@/lib/types/webhook";
import {
  getWebhookDelivery,
  listPendingWebhookDeliveries,
  putWebhookDelivery,
} from "@/lib/storage/webhookDeliveries";
import { getMeeting, patchMeeting } from "@/lib/storage/meetings";
import { createId } from "@/lib/utils/format-time";

export type QueueWebhookDeliveryInput = {
  meetingId: string;
  approvedVersion: number;
  destinationAlias: string;
  includeFlags: WebhookIncludeFlags;
  payloadSnapshot: Record<string, unknown>;
  eventId?: string;
  confirmedAt?: string;
};

export type ProcessDeliveryResult = {
  delivery: WebhookDelivery;
  processed: boolean;
};

const inFlight = new Set<string>();
let globalTimer: ReturnType<typeof setTimeout> | null = null;

function isRetryableHttpStatus(status: number | null): boolean {
  if (status == null) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

export function nextRetryAtIso(attemptCount: number, from = Date.now()): string | null {
  const delay = WEBHOOK_RETRY_DELAYS_MS[attemptCount - 1];
  if (delay == null) return null;
  return new Date(from + delay).toISOString();
}

export async function queueWebhookDelivery(
  input: QueueWebhookDeliveryInput,
): Promise<WebhookDelivery> {
  const now = new Date().toISOString();
  const eventId = input.eventId ?? createId("evt");
  const delivery: WebhookDelivery = {
    id: createId("whd"),
    eventId,
    meetingId: input.meetingId,
    approvedVersion: input.approvedVersion,
    destinationAlias: input.destinationAlias,
    includeFlags: input.includeFlags,
    payloadSnapshot: input.payloadSnapshot,
    status: "queued",
    attemptCount: 0,
    maxAttempts: WEBHOOK_MAX_ATTEMPTS,
    nextRetryAt: null,
    confirmedAt: input.confirmedAt ?? now,
    createdAt: now,
    updatedAt: now,
    attempts: [],
    lastHttpStatus: null,
    lastError: null,
  };
  await putWebhookDelivery(delivery);
  scheduleWebhookQueue();
  return delivery;
}

export async function cancelWebhookDelivery(
  id: string,
): Promise<WebhookDelivery | null> {
  const delivery = await getWebhookDelivery(id);
  if (!delivery) return null;
  if (delivery.status !== "queued" && delivery.status !== "retry_wait") {
    return delivery;
  }
  const next: WebhookDelivery = {
    ...delivery,
    status: "cancelled",
    nextRetryAt: null,
    updatedAt: new Date().toISOString(),
  };
  await putWebhookDelivery(next);
  return next;
}

/** Manual retry of a final failure — keeps the same event_id and payload. */
export async function requeueFailedWebhookDelivery(
  id: string,
): Promise<WebhookDelivery | null> {
  const delivery = await getWebhookDelivery(id);
  if (!delivery || delivery.status !== "failed") return delivery ?? null;
  const next: WebhookDelivery = {
    ...delivery,
    status: "queued",
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
  await putWebhookDelivery(next);
  scheduleWebhookQueue();
  return next;
}

async function postPayload(
  payload: Record<string, unknown>,
): Promise<{
  ok: boolean;
  status: number | null;
  error: string | null;
  responseTimeMs: number;
  eventId?: string;
}> {
  const started = performance.now();
  try {
    const response = await fetch("/api/webhooks/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      eventId?: string;
      status?: number;
    } | null;
    const responseTimeMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return {
        ok: false,
        status: data?.status ?? response.status,
        error: data?.error ?? "웹훅 전송에 실패했습니다.",
        responseTimeMs,
      };
    }
    return {
      ok: true,
      status: data?.status ?? response.status,
      error: null,
      responseTimeMs,
      eventId: data?.eventId,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error:
        err instanceof Error ? err.message : "웹훅 전송 중 오류가 발생했습니다.",
      responseTimeMs: Math.round(performance.now() - started),
    };
  }
}

async function syncMeetingDisplayStatus(delivery: WebhookDelivery) {
  const meeting = await getMeeting(delivery.meetingId);
  if (!meeting?.confirmed) return;
  if (meeting.displayStatus === "검토 필요") return;

  if (delivery.status === "succeeded") {
    await patchMeeting(delivery.meetingId, { displayStatus: "전송 완료" });
    return;
  }
  if (delivery.status === "failed") {
    await patchMeeting(delivery.meetingId, { displayStatus: "전송 실패" });
  }
}

export async function processWebhookDelivery(
  id: string,
): Promise<ProcessDeliveryResult | null> {
  if (inFlight.has(id)) {
    const current = await getWebhookDelivery(id);
    return current ? { delivery: current, processed: false } : null;
  }

  const delivery = await getWebhookDelivery(id);
  if (!delivery) return null;
  if (delivery.status !== "queued" && delivery.status !== "retry_wait") {
    return { delivery, processed: false };
  }
  if (
    delivery.status === "retry_wait" &&
    delivery.nextRetryAt &&
    new Date(delivery.nextRetryAt).getTime() > Date.now()
  ) {
    return { delivery, processed: false };
  }

  inFlight.add(id);
  try {
    const startedAt = new Date().toISOString();
    const sending: WebhookDelivery = {
      ...delivery,
      status: "sending",
      updatedAt: startedAt,
    };
    await putWebhookDelivery(sending);

    const result = await postPayload(delivery.payloadSnapshot);
    const finishedAt = new Date().toISOString();
    const attemptNumber = delivery.attemptCount + 1;
    const attempt: WebhookDeliveryAttempt = {
      attemptNumber,
      startedAt,
      finishedAt,
      httpStatus: result.status,
      ok: result.ok,
      errorMessage: result.error,
      responseTimeMs: result.responseTimeMs,
    };

    if (result.ok) {
      const succeeded: WebhookDelivery = {
        ...sending,
        status: "succeeded",
        attemptCount: attemptNumber,
        nextRetryAt: null,
        attempts: [...delivery.attempts, attempt],
        lastHttpStatus: result.status,
        lastError: null,
        updatedAt: finishedAt,
      };
      await putWebhookDelivery(succeeded);
      await syncMeetingDisplayStatus(succeeded);
      return { delivery: succeeded, processed: true };
    }

    const retryable = isRetryableHttpStatus(result.status);
    const canRetry =
      retryable && attemptNumber < delivery.maxAttempts;
    const nextRetryAt = canRetry ? nextRetryAtIso(attemptNumber) : null;
    const failedOrWait: WebhookDelivery = {
      ...sending,
      status: canRetry ? "retry_wait" : "failed",
      attemptCount: attemptNumber,
      nextRetryAt,
      attempts: [...delivery.attempts, attempt],
      lastHttpStatus: result.status,
      lastError: result.error,
      updatedAt: finishedAt,
    };
    await putWebhookDelivery(failedOrWait);
    await syncMeetingDisplayStatus(failedOrWait);
    return { delivery: failedOrWait, processed: true };
  } finally {
    inFlight.delete(id);
  }
}

export async function processDueWebhookDeliveries(): Promise<
  WebhookDelivery[]
> {
  const pending = await listPendingWebhookDeliveries();
  const now = Date.now();
  const due = pending.filter((delivery) => {
    if (delivery.status === "queued") return true;
    if (!delivery.nextRetryAt) return true;
    return new Date(delivery.nextRetryAt).getTime() <= now;
  });

  const results: WebhookDelivery[] = [];
  for (const delivery of due) {
    const result = await processWebhookDelivery(delivery.id);
    if (result) results.push(result.delivery);
  }
  scheduleWebhookQueue();
  return results;
}

export function scheduleWebhookQueue() {
  if (typeof window === "undefined") return;
  if (globalTimer) {
    clearTimeout(globalTimer);
    globalTimer = null;
  }

  void (async () => {
    const pending = await listPendingWebhookDeliveries();
    if (pending.length === 0) return;

    const now = Date.now();
    let soonest = Number.POSITIVE_INFINITY;
    for (const delivery of pending) {
      if (delivery.status === "queued") {
        soonest = Math.min(soonest, now);
      } else if (delivery.nextRetryAt) {
        soonest = Math.min(soonest, new Date(delivery.nextRetryAt).getTime());
      }
    }
    if (!Number.isFinite(soonest)) return;

    const delay = Math.max(0, soonest - now);
    globalTimer = setTimeout(() => {
      globalTimer = null;
      void processDueWebhookDeliveries();
    }, Math.min(delay, 60_000));
  })();
}
