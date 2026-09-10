"use client";

import { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/common/AppHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { MeetingCard } from "@/components/meeting/MeetingCard";
import { MeetingFilter } from "@/components/meeting/MeetingFilter";
import { StorageBar } from "@/components/meeting/StorageBar";
import { useMeetings } from "@/lib/hooks/useMeetings";
import { getNotesByMeeting } from "@/lib/storage/notes";
import type { Meeting } from "@/lib/types/meeting";

export function MeetingList() {
  const {
    meetings,
    visibleMeetings,
    filters,
    setFilters,
    isLoading,
    error,
    storage,
    removeMeeting,
    resetFilters,
    reload,
  } = useMeetings();
  const [pendingDelete, setPendingDelete] = useState<Meeting | null>(null);

  async function handleExport(meeting: Meeting) {
    const notes = await getNotesByMeeting(meeting.id);
    const blob = new Blob(
      [JSON.stringify({ meeting, notes }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = meeting.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
    link.href = url;
    link.download = `${safeTitle || "meeting"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            회의
          </h1>
          <Link href="/meetings/new" className="btn btn-primary px-4 py-2.5">
            + 새 회의
          </Link>
        </div>

        {meetings.length > 0 && (
          <div className="mt-5">
            <MeetingFilter filters={filters} onChange={setFilters} />
          </div>
        )}

        <div className="mt-6 flex-1">
          {isLoading && (
            <p className="py-16 text-center text-sm text-[var(--muted)]">
              회의 목록을 불러오는 중…
            </p>
          )}

          {!isLoading && error && (
            <p className="py-16 text-center text-sm text-[var(--danger)]">
              {error}
            </p>
          )}

          {!isLoading && !error && meetings.length === 0 && (
            <EmptyState
              title="회의 기록을 더 쉽게 관리해보세요."
              description={"회의를 녹음하면 AI가\n요약과 상세 회의록을 생성합니다."}
              action={
                <Link href="/meetings/new" className="btn btn-primary px-5 py-2.5">
                  첫 회의 녹음하기
                </Link>
              }
            />
          )}

          {!isLoading &&
            !error &&
            meetings.length > 0 &&
            visibleMeetings.length === 0 && (
              <EmptyState
                title="검색 조건에 맞는 회의가 없습니다."
                action={
                  <button
                    type="button"
                    className="btn btn-ghost px-4 py-2.5"
                    onClick={resetFilters}
                  >
                    필터 초기화
                  </button>
                }
              />
            )}

          {!isLoading && visibleMeetings.length > 0 && (
            <ul className="space-y-3">
              {visibleMeetings.map((meeting) => (
                <li key={meeting.id}>
                  <MeetingCard
                    meeting={meeting}
                    onDelete={setPendingDelete}
                    onExport={(item) => void handleExport(item)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto pt-8">
          <StorageBar
            usage={storage.usage}
            quota={storage.quota}
            onRestored={reload}
          />
        </div>
      </main>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="회의를 삭제하시겠습니까?"
        description={
          pendingDelete
            ? `'${pendingDelete.title}'의 음성, 전사문,\nAI 회의록 및 버전 정보가 삭제됩니다.\n\n이 작업은 취소할 수 없습니다.`
            : ""
        }
        confirmLabel="회의 삭제"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const id = pendingDelete.id;
          setPendingDelete(null);
          void removeMeeting(id);
        }}
      />
    </div>
  );
}
