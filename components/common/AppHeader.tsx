"use client";

import { useState } from "react";
import Link from "next/link";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

export function AppHeader() {
  const [settingsOpen, setSettingsOpen] = useState(false);

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

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
