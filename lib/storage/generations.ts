import {
  GENERATIONS_STORE,
  openDb,
  requestToPromise,
} from "@/lib/storage/db";
import type { MeetingDetailMinutes } from "@/lib/types/detail";
import type {
  GenerationSource,
  MeetingGeneration,
} from "@/lib/types/generation";

export async function getMeetingGeneration(
  meetingId: string,
): Promise<MeetingGeneration | undefined> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(GENERATIONS_STORE)) {
      return undefined;
    }
    const tx = db.transaction(GENERATIONS_STORE, "readonly");
    const row = (await requestToPromise(
      tx.objectStore(GENERATIONS_STORE).get(meetingId),
    )) as MeetingGeneration | undefined;
    return row
      ? {
          ...row,
          detailMinutes: row.detailMinutes ?? null,
          aiOriginalSummaryText: row.aiOriginalSummaryText ?? null,
          aiOriginalDetailMinutes: row.aiOriginalDetailMinutes ?? null,
          aiOriginalDetailText: row.aiOriginalDetailText ?? null,
          inputFingerprint: row.inputFingerprint ?? null,
          confirmedVersionNumber: row.confirmedVersionNumber ?? null,
        }
      : undefined;
  } finally {
    db.close();
  }
}

export async function saveMeetingGeneration(input: {
  meetingId: string;
  summaryText?: string | null;
  detailText?: string | null;
  detailMinutes?: MeetingDetailMinutes | null;
  aiOriginalSummaryText?: string | null;
  aiOriginalDetailMinutes?: MeetingDetailMinutes | null;
  aiOriginalDetailText?: string | null;
  inputFingerprint?: string | null;
  confirmedVersionNumber?: number | null;
  source: GenerationSource;
  llmProvider?: string;
  model?: string;
  /** When true, refresh AI original fields from the new draft values. */
  preserveAsAiOriginal?: boolean;
}): Promise<MeetingGeneration> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(GENERATIONS_STORE)) {
      throw new Error(
        "generations 저장소가 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
    }

    const tx = db.transaction(GENERATIONS_STORE, "readwrite");
    const store = tx.objectStore(GENERATIONS_STORE);
    const existing = (await requestToPromise(
      store.get(input.meetingId),
    )) as MeetingGeneration | undefined;

    const summaryText =
      input.summaryText !== undefined
        ? input.summaryText
        : (existing?.summaryText ?? null);
    const detailText =
      input.detailText !== undefined
        ? input.detailText
        : (existing?.detailText ?? null);
    const detailMinutes =
      input.detailMinutes !== undefined
        ? input.detailMinutes
        : (existing?.detailMinutes ?? null);

    let aiOriginalSummaryText =
      input.aiOriginalSummaryText !== undefined
        ? input.aiOriginalSummaryText
        : (existing?.aiOriginalSummaryText ?? null);
    let aiOriginalDetailMinutes =
      input.aiOriginalDetailMinutes !== undefined
        ? input.aiOriginalDetailMinutes
        : (existing?.aiOriginalDetailMinutes ?? null);
    let aiOriginalDetailText =
      input.aiOriginalDetailText !== undefined
        ? input.aiOriginalDetailText
        : (existing?.aiOriginalDetailText ?? null);

    if (input.preserveAsAiOriginal) {
      if (input.summaryText !== undefined) {
        aiOriginalSummaryText = input.summaryText;
      }
      if (input.detailMinutes !== undefined) {
        aiOriginalDetailMinutes = input.detailMinutes;
      }
      if (input.detailText !== undefined) {
        aiOriginalDetailText = input.detailText;
      }
    } else if (!existing) {
      aiOriginalSummaryText = summaryText;
      aiOriginalDetailMinutes = detailMinutes;
      aiOriginalDetailText = detailText;
    }

    const next: MeetingGeneration = {
      meetingId: input.meetingId,
      summaryText,
      detailText,
      detailMinutes,
      aiOriginalSummaryText,
      aiOriginalDetailMinutes,
      aiOriginalDetailText,
      inputFingerprint:
        input.inputFingerprint !== undefined
          ? input.inputFingerprint
          : (existing?.inputFingerprint ?? null),
      confirmedVersionNumber:
        input.confirmedVersionNumber !== undefined
          ? input.confirmedVersionNumber
          : (existing?.confirmedVersionNumber ?? null),
      source: input.source,
      llmProvider:
        input.llmProvider !== undefined
          ? input.llmProvider
          : existing?.llmProvider,
      model: input.model !== undefined ? input.model : existing?.model,
      updatedAt: new Date().toISOString(),
    };

    await requestToPromise(store.put(next));
    return next;
  } finally {
    db.close();
  }
}

export async function deleteMeetingGeneration(meetingId: string) {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(GENERATIONS_STORE)) return;
    const tx = db.transaction(GENERATIONS_STORE, "readwrite");
    await requestToPromise(
      tx.objectStore(GENERATIONS_STORE).delete(meetingId),
    );
  } finally {
    db.close();
  }
}

export async function getAllGenerations(): Promise<MeetingGeneration[]> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(GENERATIONS_STORE)) return [];
    const tx = db.transaction(GENERATIONS_STORE, "readonly");
    const rows = await requestToPromise(
      tx.objectStore(GENERATIONS_STORE).getAll(),
    );
    return rows as MeetingGeneration[];
  } finally {
    db.close();
  }
}

export async function findMeetingIdsByGenerationQuery(
  query: string,
): Promise<string[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const generations = await getAllGenerations();
  const ids = new Set<string>();
  for (const generation of generations) {
    const haystack = [
      generation.summaryText ?? "",
      generation.detailText ?? "",
    ]
      .join("\n")
      .toLowerCase();
    if (haystack.includes(q)) ids.add(generation.meetingId);
  }
  return [...ids];
}
