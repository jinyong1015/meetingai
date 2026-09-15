import {
  WEBHOOK_DELIVERIES_STORE,
  openDb,
  requestToPromise,
} from "@/lib/storage/db";
import type { WebhookDelivery } from "@/lib/types/webhook";

export async function listWebhookDeliveries(
  meetingId: string,
): Promise<WebhookDelivery[]> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(WEBHOOK_DELIVERIES_STORE)) return [];
    const tx = db.transaction(WEBHOOK_DELIVERIES_STORE, "readonly");
    const index = tx.objectStore(WEBHOOK_DELIVERIES_STORE).index("meetingId");
    const rows = (await requestToPromise(
      index.getAll(meetingId),
    )) as WebhookDelivery[];
    return rows.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } finally {
    db.close();
  }
}

export async function listPendingWebhookDeliveries(): Promise<
  WebhookDelivery[]
> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(WEBHOOK_DELIVERIES_STORE)) return [];
    const tx = db.transaction(WEBHOOK_DELIVERIES_STORE, "readonly");
    const rows = (await requestToPromise(
      tx.objectStore(WEBHOOK_DELIVERIES_STORE).getAll(),
    )) as WebhookDelivery[];
    return rows.filter(
      (row) => row.status === "queued" || row.status === "retry_wait",
    );
  } finally {
    db.close();
  }
}

export async function getWebhookDelivery(
  id: string,
): Promise<WebhookDelivery | undefined> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(WEBHOOK_DELIVERIES_STORE)) {
      return undefined;
    }
    const tx = db.transaction(WEBHOOK_DELIVERIES_STORE, "readonly");
    return (await requestToPromise(
      tx.objectStore(WEBHOOK_DELIVERIES_STORE).get(id),
    )) as WebhookDelivery | undefined;
  } finally {
    db.close();
  }
}

export async function putWebhookDelivery(
  delivery: WebhookDelivery,
): Promise<WebhookDelivery> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(WEBHOOK_DELIVERIES_STORE)) {
      throw new Error(
        "webhookDeliveries 저장소가 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
    }
    const tx = db.transaction(WEBHOOK_DELIVERIES_STORE, "readwrite");
    await requestToPromise(
      tx.objectStore(WEBHOOK_DELIVERIES_STORE).put(delivery),
    );
    return delivery;
  } finally {
    db.close();
  }
}

export async function deleteWebhookDeliveriesByMeeting(meetingId: string) {
  const deliveries = await listWebhookDeliveries(meetingId);
  if (deliveries.length === 0) return;
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(WEBHOOK_DELIVERIES_STORE)) return;
    const tx = db.transaction(WEBHOOK_DELIVERIES_STORE, "readwrite");
    const store = tx.objectStore(WEBHOOK_DELIVERIES_STORE);
    await Promise.all(
      deliveries.map((delivery) =>
        requestToPromise(store.delete(delivery.id)),
      ),
    );
  } finally {
    db.close();
  }
}
