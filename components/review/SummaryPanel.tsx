"use client";

type SummaryPanelProps = {
  summaryText: string | null;
  pending?: boolean;
  sourceLabel?: string | null;
};

export function SummaryPanel({
  summaryText,
  pending = false,
  sourceLabel = null,
}: SummaryPanelProps) {
  const text = summaryText?.trim() ?? "";

  return (
    <div aria-label="회의 요약">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
            핵심 요약
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            회의 내용을 요약한 텍스트입니다
            {sourceLabel ? ` · ${sourceLabel}` : ""}
          </p>
        </div>
      </div>

      {pending ? (
        <p className="text-sm text-[var(--accent)]" role="status">
          요약을 생성하는 중…
        </p>
      ) : text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          요약이 아직 생성되지 않았습니다. 가상 데이터로 미리보기를 실행하거나,
          녹음 후 AI 요약을 생성해 주세요.
        </p>
      )}
    </div>
  );
}
