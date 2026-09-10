import type { Meeting, MeetingListFilters } from "@/lib/types/meeting";

function dateKey(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function matchesQuery(meeting: Meeting, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    meeting.title,
    meeting.attendees,
    meeting.summaryPreview ?? "",
    ...meeting.tags,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function hasActiveFilters(filters: MeetingListFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.fromDate !== "" ||
    filters.toDate !== "" ||
    filters.status !== "all" ||
    filters.confirmed !== "all"
  );
}

export function filterMeetings(
  meetings: Meeting[],
  noteMatchedIds: Set<string>,
  filters: MeetingListFilters,
): Meeting[] {
  const query = filters.query.trim();

  const filtered = meetings.filter((meeting) => {
    if (query) {
      const textMatch = matchesQuery(meeting, query);
      const noteMatch = noteMatchedIds.has(meeting.id);
      if (!textMatch && !noteMatch) return false;
    }

    const key = dateKey(meeting.startedAt);
    if (filters.fromDate && key < filters.fromDate) return false;
    if (filters.toDate && key > filters.toDate) return false;

    if (filters.status !== "all" && meeting.displayStatus !== filters.status) {
      return false;
    }

    if (filters.confirmed === "draft" && meeting.confirmed) return false;
    if (filters.confirmed === "confirmed" && !meeting.confirmed) return false;

    return true;
  });

  filtered.sort((a, b) => {
    const diff =
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
    return filters.sort === "newest" ? -diff : diff;
  });

  return filtered;
}
