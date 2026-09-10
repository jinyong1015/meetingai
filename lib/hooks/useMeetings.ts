"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { findMeetingIdsByNoteQuery } from "@/lib/storage/notes";
import { deleteMeeting, getAllMeetings } from "@/lib/storage/meetings";
import { getStorageEstimate } from "@/lib/storage/backup";
import {
  filterMeetings,
  hasActiveFilters as computeHasActiveFilters,
} from "@/lib/meetings/filter";
import {
  DEFAULT_MEETING_FILTERS,
  type Meeting,
  type MeetingListFilters,
} from "@/lib/types/meeting";

const SEARCH_DEBOUNCE_MS = 300;

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filters, setFilters] = useState<MeetingListFilters>(
    DEFAULT_MEETING_FILTERS,
  );
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [noteMatchedIds, setNoteMatchedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState({ usage: 0, quota: 0 });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [loaded, estimate] = await Promise.all([
        getAllMeetings(),
        getStorageEstimate(),
      ]);
      setMeetings(loaded);
      setStorage(estimate);
    } catch {
      setError("회의 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(filters.query);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.query]);

  useEffect(() => {
    let cancelled = false;
    const query = debouncedQuery.trim();
    if (!query) {
      setNoteMatchedIds(new Set());
      return;
    }

    void findMeetingIdsByNoteQuery(query).then((ids) => {
      if (!cancelled) setNoteMatchedIds(new Set(ids));
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const appliedFilters = useMemo(
    () => ({ ...filters, query: debouncedQuery }),
    [filters, debouncedQuery],
  );

  const visibleMeetings = useMemo(
    () => filterMeetings(meetings, noteMatchedIds, appliedFilters),
    [meetings, noteMatchedIds, appliedFilters],
  );

  const hasActiveFilters = computeHasActiveFilters(appliedFilters);

  const removeMeeting = useCallback(async (id: string) => {
    await deleteMeeting(id);
    setMeetings((prev) => prev.filter((meeting) => meeting.id !== id));
    const estimate = await getStorageEstimate();
    setStorage(estimate);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_MEETING_FILTERS);
    setDebouncedQuery("");
  }, []);

  return {
    meetings,
    visibleMeetings,
    filters,
    setFilters,
    isLoading,
    error,
    storage,
    hasActiveFilters,
    removeMeeting,
    resetFilters,
    reload: load,
  };
}
