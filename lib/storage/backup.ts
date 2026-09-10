import { getAllMeetings, putMeetings } from "@/lib/storage/meetings";
import { getAllNotes, putNotes } from "@/lib/storage/notes";
import {
  BACKUP_FORMAT_VERSION,
  type MeetingBackup,
} from "@/lib/types/meeting";

export async function exportMeetingBackup(): Promise<MeetingBackup> {
  const [meetings, notes] = await Promise.all([getAllMeetings(), getAllNotes()]);
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    meetings,
    notes,
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

export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
}> {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0 };
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
