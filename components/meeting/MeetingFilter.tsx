"use client";

import {
  MEETING_DISPLAY_STATUSES,
  type MeetingListFilters,
} from "@/lib/types/meeting";

type MeetingFilterProps = {
  filters: MeetingListFilters;
  onChange: (next: MeetingListFilters) => void;
};

export function MeetingFilter({ filters, onChange }: MeetingFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={filters.query}
        onChange={(event) =>
          onChange({ ...filters, query: event.target.value })
        }
        placeholder="검색"
        aria-label="회의 검색"
        className="field min-w-[12rem] flex-1"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          기간
          <input
            type="date"
            value={filters.fromDate}
            onChange={(event) =>
              onChange({ ...filters, fromDate: event.target.value })
            }
            aria-label="시작일"
            className="field w-[9.5rem]"
          />
          <span aria-hidden>~</span>
          <input
            type="date"
            value={filters.toDate}
            onChange={(event) =>
              onChange({ ...filters, toDate: event.target.value })
            }
            aria-label="종료일"
            className="field w-[9.5rem]"
          />
        </label>
        <select
          value={filters.status}
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as MeetingListFilters["status"],
            })
          }
          aria-label="상태"
          className="field w-[8.5rem]"
        >
          <option value="all">전체 상태</option>
          {MEETING_DISPLAY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={filters.confirmed}
          onChange={(event) =>
            onChange({
              ...filters,
              confirmed: event.target
                .value as MeetingListFilters["confirmed"],
            })
          }
          aria-label="확정"
          className="field w-[7.5rem]"
        >
          <option value="all">전체 확정</option>
          <option value="draft">초안</option>
          <option value="confirmed">확정</option>
        </select>
        <select
          value={filters.sort}
          onChange={(event) =>
            onChange({
              ...filters,
              sort: event.target.value as MeetingListFilters["sort"],
            })
          }
          aria-label="정렬"
          className="field w-[8rem]"
        >
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
        </select>
      </div>
    </div>
  );
}
