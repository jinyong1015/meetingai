import {
  VERSIONS_STORE,
  openDb,
  requestToPromise,
} from "@/lib/storage/db";
import type { MeetingDetailMinutes } from "@/lib/types/detail";
import type { GenerationSource } from "@/lib/types/generation";
import {
  versionKindLabel,
  type GenerationVersion,
  type GenerationVersionKind,
} from "@/lib/types/version";
import { createId } from "@/lib/utils/format-time";

export async function listGenerationVersions(
  meetingId: string,
): Promise<GenerationVersion[]> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(VERSIONS_STORE)) return [];
    const tx = db.transaction(VERSIONS_STORE, "readonly");
    const index = tx.objectStore(VERSIONS_STORE).index("meetingId");
    const rows = (await requestToPromise(
      index.getAll(meetingId),
    )) as GenerationVersion[];
    return rows.sort((a, b) => b.versionNumber - a.versionNumber);
  } finally {
    db.close();
  }
}

export async function getGenerationVersion(
  id: string,
): Promise<GenerationVersion | undefined> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(VERSIONS_STORE)) return undefined;
    const tx = db.transaction(VERSIONS_STORE, "readonly");
    return (await requestToPromise(
      tx.objectStore(VERSIONS_STORE).get(id),
    )) as GenerationVersion | undefined;
  } finally {
    db.close();
  }
}

async function nextVersionNumber(meetingId: string): Promise<number> {
  const versions = await listGenerationVersions(meetingId);
  if (versions.length === 0) return 1;
  return Math.max(...versions.map((v) => v.versionNumber)) + 1;
}

export async function createGenerationVersion(input: {
  meetingId: string;
  kind: GenerationVersionKind;
  label?: string;
  summaryText: string | null;
  detailText: string | null;
  detailMinutes: MeetingDetailMinutes | null;
  source: GenerationSource;
  restoredFromVersionNumber?: number;
}): Promise<GenerationVersion> {
  const versionNumber = await nextVersionNumber(input.meetingId);
  const label =
    input.label ??
    (input.kind === "restored" && input.restoredFromVersionNumber != null
      ? `v${input.restoredFromVersionNumber}에서 복원`
      : versionKindLabel(input.kind));

  const version: GenerationVersion = {
    id: createId("ver"),
    meetingId: input.meetingId,
    versionNumber,
    kind: input.kind,
    label,
    summaryText: input.summaryText,
    detailText: input.detailText,
    detailMinutes: input.detailMinutes,
    source: input.source,
    createdAt: new Date().toISOString(),
    restoredFromVersionNumber: input.restoredFromVersionNumber,
  };

  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
      throw new Error(
        "versions 저장소가 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
    }
    const tx = db.transaction(VERSIONS_STORE, "readwrite");
    await requestToPromise(tx.objectStore(VERSIONS_STORE).put(version));
    return version;
  } finally {
    db.close();
  }
}

export async function deleteGenerationVersionsByMeeting(meetingId: string) {
  const versions = await listGenerationVersions(meetingId);
  if (versions.length === 0) return;
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains(VERSIONS_STORE)) return;
    const tx = db.transaction(VERSIONS_STORE, "readwrite");
    const store = tx.objectStore(VERSIONS_STORE);
    await Promise.all(
      versions.map((version) => requestToPromise(store.delete(version.id))),
    );
  } finally {
    db.close();
  }
}
