"use client";

import { useId, useRef, useState } from "react";
import {
  exportMeetingBackup,
  parseMeetingBackup,
  restoreMeetingBackup,
} from "@/lib/storage/backup";
import { formatBytes } from "@/lib/utils/format-time";

type StorageBarProps = {
  usage: number;
  quota: number;
  onRestored: () => Promise<void> | void;
};

export function StorageBar({ usage, quota, onRestored }: StorageBarProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  async function handleBackup() {
    setError(null);
    try {
      const backup = await exportMeetingBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `meetingai-backup-${stamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("백업 파일을 저장했습니다.");
    } catch {
      setError("백업 파일을 만들지 못했습니다.");
    }
  }

  async function handleRestore(file: File) {
    setError(null);
    setMessage(null);
    try {
      const parsed = parseMeetingBackup(JSON.parse(await file.text()));
      await restoreMeetingBackup(parsed);
      await onRestored();
      setMessage("백업 파일을 가져왔습니다. 같은 ID의 회의는 덮어씁니다.");
    } catch {
      setError("백업 파일을 읽거나 복원하지 못했습니다.");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
        <p>
          저장 공간 {formatBytes(usage)} 사용
          {quota > 0 ? ` · ${formatBytes(quota)} 중` : ""}
        </p>
        <button
          type="button"
          className="btn btn-ghost px-3 py-2"
          onClick={() => {
            setOpen(true);
            setError(null);
            setMessage(null);
          }}
        >
          백업 관리
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.35)] p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="glass-panel w-full max-w-md rounded-[var(--radius)] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              백업 관리
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              회의 데이터는 현재 브라우저에 저장됩니다. 브라우저 데이터를
              삭제하면 회의 기록이 삭제될 수 있습니다.
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              사용 중 {formatBytes(usage)}
              {quota > 0 ? ` · 예상 사용 가능 ${formatBytes(Math.max(0, quota - usage))}` : ""}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-primary px-4 py-2.5"
                onClick={() => void handleBackup()}
              >
                회의 데이터 백업
              </button>
              <button
                type="button"
                className="btn btn-ghost px-4 py-2.5"
                onClick={() => fileRef.current?.click()}
              >
                백업 파일 복원
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleRestore(file);
                }}
              />
            </div>
            {message && (
              <p className="mt-3 text-sm text-[var(--success)]">{message}</p>
            )}
            {error && (
              <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
            )}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="btn btn-ghost px-4 py-2"
                onClick={() => setOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
