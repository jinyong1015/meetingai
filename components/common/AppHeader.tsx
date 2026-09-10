"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

export function AppHeader() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!settingsOpen) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight"
          >
            AI 회의노트
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-white/50 px-3 py-1.5 text-xs font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
              로컬 저장됨
            </span>
            <button
              type="button"
              className="btn btn-ghost h-9 px-3 text-sm"
              onClick={() => setSettingsOpen(true)}
            >
              ⚙ 설정
            </button>
          </div>
        </div>
      </header>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.35)] p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="glass-panel w-full max-w-md rounded-[var(--radius)] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              설정
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              일반 설정과 AI 엔진 선택은 다음 단계에서 제공됩니다. 회의 데이터
              백업은 목록 하단의 백업 관리에서 사용할 수 있습니다.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                ref={closeRef}
                type="button"
                className="btn btn-primary px-4 py-2"
                onClick={() => setSettingsOpen(false)}
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
