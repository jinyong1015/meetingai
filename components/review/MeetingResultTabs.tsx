"use client";

import { DetailPanel } from "@/components/review/DetailPanel";
import { SummaryPanel } from "@/components/review/SummaryPanel";
import { TranscriptResultPanel } from "@/components/recording/TranscriptResultPanel";
import type { MeetingDetailMinutes } from "@/lib/types/detail";
import type { MeetingResultTab } from "@/lib/types/generation";
import type { TranscriptSegment } from "@/lib/types/transcript";

type MeetingResultTabsProps = {
  activeTab: MeetingResultTab;
  onTabChange: (tab: MeetingResultTab) => void;
  segments: TranscriptSegment[];
  providerLabel: string;
  transcriptPending?: boolean;
  transcriptError?: string | null;
  summaryText: string | null;
  detailMinutes: MeetingDetailMinutes | null;
  detailText?: string | null;
  summaryPending?: boolean;
  detailPending?: boolean;
  summarySourceLabel?: string | null;
  detailSourceLabel?: string | null;
  onSaveDetail?: (next: MeetingDetailMinutes) => Promise<void> | void;
};

const TABS: { id: MeetingResultTab; label: string }[] = [
  { id: "transcript", label: "전사문" },
  { id: "summary", label: "요약" },
  { id: "detail", label: "상세" },
];

export function MeetingResultTabs({
  activeTab,
  onTabChange,
  segments,
  providerLabel,
  transcriptPending = false,
  transcriptError = null,
  summaryText,
  detailMinutes,
  detailText = null,
  summaryPending = false,
  detailPending = false,
  summarySourceLabel = null,
  detailSourceLabel = null,
  onSaveDetail,
}: MeetingResultTabsProps) {
  return (
    <section
      className="glass-panel rounded-[var(--radius)] p-5 sm:p-6"
      aria-label="회의 결과"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
            회의 결과
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            전사문 · 요약 · 상세를 전환해 확인할 수 있습니다
          </p>
        </div>
        <div
          className="flex rounded-xl bg-white/55 p-1 ring-1 ring-[var(--border)]"
          role="tablist"
          aria-label="결과 탭"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {activeTab === "summary" && (
          <SummaryPanel
            summaryText={summaryText}
            pending={summaryPending}
            sourceLabel={summarySourceLabel}
          />
        )}
        {activeTab === "detail" && (
          <DetailPanel
            detailMinutes={detailMinutes}
            detailText={detailText}
            pending={detailPending}
            sourceLabel={detailSourceLabel}
            onSave={onSaveDetail}
          />
        )}
        {activeTab === "transcript" && (
          <TranscriptResultPanel
            segments={segments}
            providerLabel={providerLabel}
            pending={transcriptPending}
            error={transcriptError}
            embedded
          />
        )}
      </div>
    </section>
  );
}
