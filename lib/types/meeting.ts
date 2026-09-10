export const MEETING_DISPLAY_STATUSES = [
  "준비",
  "녹음 중",
  "저장 중",
  "AI 처리 중",
  "검토 필요",
  "확정됨",
  "전송 완료",
  "처리 실패",
  "전송 실패",
  "복구 필요",
] as const;

export type MeetingDisplayStatus = (typeof MEETING_DISPLAY_STATUSES)[number];

export type Meeting = {
  id: string;
  title: string;
  startedAt: string;
  durationSec: number;
  timezone: string;
  attendees: string;
  tags: string[];
  summaryPreview: string | null;
  confirmed: boolean;
  displayStatus: MeetingDisplayStatus;
  createdAt: string;
  updatedAt: string;
};

export type MeetingConfirmedFilter = "all" | "draft" | "confirmed";
export type MeetingSort = "newest" | "oldest";

export type MeetingListFilters = {
  query: string;
  fromDate: string;
  toDate: string;
  status: "all" | MeetingDisplayStatus;
  confirmed: MeetingConfirmedFilter;
  sort: MeetingSort;
};

export const DEFAULT_MEETING_FILTERS: MeetingListFilters = {
  query: "",
  fromDate: "",
  toDate: "",
  status: "all",
  confirmed: "all",
  sort: "newest",
};

export const BACKUP_FORMAT_VERSION = 1;

export type MeetingBackup = {
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  meetings: Meeting[];
  notes: import("./note").Note[];
};
