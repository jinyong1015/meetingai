import { getAllMeetings, putMeetings } from "@/lib/storage/meetings";
import {
  deleteOrphanNotes,
  getAllNotes,
  putNotes,
} from "@/lib/storage/notes";
import {
  BACKUP_FORMAT_VERSION,
  type MeetingBackup,
} from "@/lib/types/meeting";

export async function exportMeetingBackup(): Promise<MeetingBackup> {
  const [meetings, notes] = await Promise.all([getAllMeetings(), getAllNotes()]);
  const meetingIds = new Set(meetings.map((meeting) => meeting.id));
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    meetings,
    notes: notes.filter((note) => meetingIds.has(note.meetingId)),
  };
}

export function parseMeetingBackup(raw: unknown): MeetingBackup {
  if (!raw || typeof raw !== "object") {
    throw new Error("백업 파일 형식을 확인할 수 없습니다.");
  }
  const data = raw as Partial<MeetingBackup>;
  if (!Array.isArray(data.meetings) || !Array.isArray(data.notes)) {
    throw new Error("백업 파일에 회의 또는 메모 목록이 없습니다.");
  }
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt:
      typeof data.exportedAt === "string"
        ? data.exportedAt
        : new Date().toISOString(),
    meetings: data.meetings,
    notes: data.notes,
  };
}

export async function restoreMeetingBackup(backup: MeetingBackup) {
  await Promise.all([
    putMeetings(backup.meetings),
    putNotes(backup.notes),
  ]);
}

/** UTF-8 byte length of a JSON-serializable value (approx. IndexedDB payload). */
function byteLengthOf(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Estimates MeetingAI meeting/note data size — not the whole browser origin.
 * Orphan notes (no matching meeting) are deleted, then usage is summed.
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
}> {
  const meetings = await getAllMeetings();
  const meetingIds = new Set(meetings.map((meeting) => meeting.id));
  await deleteOrphanNotes(meetingIds);

  const [notes, estimate] = await Promise.all([
    getAllNotes(),
    navigator.storage?.estimate?.() ?? Promise.resolve(undefined),
  ]);

  const linkedNotes = notes.filter((note) => meetingIds.has(note.meetingId));
  const usage =
    meetings.length === 0
      ? 0
      : byteLengthOf(meetings) + byteLengthOf(linkedNotes);
  const quota = estimate?.quota ?? 0;
  return { usage, quota };
}
