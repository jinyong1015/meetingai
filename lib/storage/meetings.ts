import { MEETINGS_STORE, openDb, requestToPromise } from "@/lib/storage/db";
import { deleteNotesByMeeting } from "@/lib/storage/notes";
import type { Meeting } from "@/lib/types/meeting";
import { createId } from "@/lib/utils/format-time";

export function defaultMeetingTitle(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `새 회의 ${year}-${month}-${day} ${hours}:${minutes}`;
}

export async function getAllMeetings(): Promise<Meeting[]> {
  const db = await openDb();
  const tx = db.transaction(MEETINGS_STORE, "readonly");
  const meetings = await requestToPromise(tx.objectStore(MEETINGS_STORE).getAll());
  db.close();
  return meetings as Meeting[];
}

export async function getMeeting(id: string): Promise<Meeting | undefined> {
  const db = await openDb();
  const tx = db.transaction(MEETINGS_STORE, "readonly");
  const meeting = await requestToPromise(tx.objectStore(MEETINGS_STORE).get(id));
  db.close();
  return meeting as Meeting | undefined;
}

export async function putMeeting(meeting: Meeting) {
  const db = await openDb();
  const tx = db.transaction(MEETINGS_STORE, "readwrite");
  await requestToPromise(tx.objectStore(MEETINGS_STORE).put(meeting));
  db.close();
}

export async function putMeetings(meetings: Meeting[]) {
  if (meetings.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(MEETINGS_STORE, "readwrite");
  const store = tx.objectStore(MEETINGS_STORE);
  await Promise.all(meetings.map((meeting) => requestToPromise(store.put(meeting))));
  db.close();
}

export async function patchMeeting(
  id: string,
  patch: Partial<Meeting>,
): Promise<Meeting | undefined> {
  const current = await getMeeting(id);
  if (!current) return undefined;
  const next: Meeting = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  await putMeeting(next);
  return next;
}

export async function createMeeting(
  partial?: Partial<Meeting>,
): Promise<Meeting> {
  const now = new Date();
  const meeting: Meeting = {
    id: createId("meeting"),
    title: defaultMeetingTitle(now),
    startedAt: now.toISOString(),
    durationSec: 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    attendees: "",
    tags: [],
    summaryPreview: null,
    confirmed: false,
    displayStatus: "준비",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...partial,
  };
  await putMeeting(meeting);
  return meeting;
}

export async function deleteMeeting(id: string) {
  await deleteNotesByMeeting(id);
  const db = await openDb();
  const tx = db.transaction(MEETINGS_STORE, "readwrite");
  await requestToPromise(tx.objectStore(MEETINGS_STORE).delete(id));
  db.close();
}
