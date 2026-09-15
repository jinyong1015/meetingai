"use client";

import type { GenerationVersion } from "@/lib/types/version";
import { formatMeetingDateTime } from "@/lib/utils/format-time";

type HistoryPanelProps = {
  versions: GenerationVersion[];
  viewingVersionId: string | null;
  onViewVersion: (version: GenerationVersion) => void;
  onRestoreVersion: (version: GenerationVersion) => void;
  onViewCurrentDraft: () => void;
};

export function HistoryPanel({
  versions,
  viewingVersionId,
  onViewVersion,
  onRestoreVersion,
  onViewCurrentDraft,
}: HistoryPanelProps) {
  if (versions.length === 0) {
    return (
      <div aria-label="버전 이력">
        <h3 className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
          버전 이력
        </h3>
        <p className="mt-3 text-sm text-[var(--muted)]">
          아직 저장된 버전이 없습니다. AI 생성·수정·확정 시 이력이 쌓입니다.
        </p>
      </div>
    );
  }

  return (
    <div aria-label="버전 이력">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
            버전 이력
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            확정본·AI 생성·사용자 수정·복원 이력을 확인할 수 있습니다
          </p>
        </div>
        {viewingVersionId && (
          <button
            type="button"
            className="btn btn-ghost px-3 py-1.5 text-sm"
            onClick={onViewCurrentDraft}
          >
            현재 초안으로 돌아가기
          </button>
        )}
      </div>

      <ol className="space-y-3">
        {versions.map((version) => {
          const selected = viewingVersionId === version.id;
          const isConfirmed = version.kind === "confirmed";
          return (
            <li
              key={version.id}
              className={`rounded-xl px-4 py-3 ring-1 ${
                selected
                  ? "bg-[var(--accent-soft)] ring-[var(--accent)]/30"
                  : "bg-white/55 ring-[var(--border)]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    v{version.versionNumber}
                    {isConfirmed ? (
                      <span className="ml-2 text-[var(--success)]">확정본</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatMeetingDateTime(version.createdAt)} · {version.label}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost px-3 py-1.5 text-xs"
                    onClick={() => onViewVersion(version)}
                  >
                    이 버전 보기
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost px-3 py-1.5 text-xs"
                    onClick={() => onRestoreVersion(version)}
                  >
                    이 버전으로 복원
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
