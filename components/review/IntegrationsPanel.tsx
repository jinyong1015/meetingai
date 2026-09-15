"use client";

type SendStatus = "idle" | "sending" | "success" | "error";

type IntegrationsPanelProps = {
  confirmed: boolean;
  confirmedVersionNumber: number | null;
  sendStatus?: SendStatus;
  sendMessage?: string | null;
  onSend?: () => void;
  onOpenSettings?: () => void;
};

export function IntegrationsPanel({
  confirmed,
  confirmedVersionNumber,
  sendStatus = "idle",
  sendMessage = null,
  onSend,
  onOpenSettings,
}: IntegrationsPanelProps) {
  const sending = sendStatus === "sending";
  const canSend = confirmed && Boolean(onSend) && !sending;

  const statusLabel =
    sendStatus === "sending"
      ? "전송 중…"
      : sendStatus === "success"
        ? "전송 완료"
        : sendStatus === "error"
          ? "전송 실패"
          : confirmed
            ? "대기 · Make 웹훅으로 마크다운 전송"
            : "웹훅 연동 준비됨 · 확정 후 전송 가능";

  return (
    <div aria-label="외부 연동">
      <h3 className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
        외부 연동
      </h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        확정본의 메모 · 요약 · 회의록을 마크다운으로 Make 웹훅에 전송합니다
      </p>

      <dl className="mt-5 space-y-3 rounded-xl bg-white/55 px-4 py-4 ring-1 ring-[var(--border)]">
        <div>
          <dt className="text-xs text-[var(--muted)]">현재 확정 버전</dt>
          <dd className="mt-1 text-sm font-medium">
            {confirmed && confirmedVersionNumber != null
              ? `v${confirmedVersionNumber}`
              : "없음"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">포함 항목</dt>
          <dd className="mt-1 text-sm font-medium">메모 · 요약 · 회의록 (마크다운)</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">발송 상태</dt>
          <dd
            className={`mt-1 text-sm font-medium ${
              sendStatus === "success"
                ? "text-[var(--success)]"
                : sendStatus === "error"
                  ? "text-[var(--danger)]"
                  : "text-[var(--muted)]"
            }`}
          >
            {statusLabel}
          </dd>
        </div>
      </dl>

      {sendMessage && (
        <p
          className={`mt-4 text-sm ${
            sendStatus === "error"
              ? "text-[var(--danger)]"
              : "text-[var(--muted)]"
          }`}
          role={sendStatus === "error" ? "alert" : "status"}
        >
          {sendMessage}
        </p>
      )}

      {!confirmed && (
        <p className="mt-4 text-sm text-[var(--warning)]">
          확정본이 없어 전송할 수 없습니다. 먼저 회의록을 검토·확정해 주세요.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary px-3 py-1.5 text-sm"
          disabled={!canSend}
          onClick={onSend}
        >
          {sending ? "전송 중…" : "확정본 전송"}
        </button>
        {onOpenSettings && (
          <button
            type="button"
            className="btn btn-ghost px-3 py-1.5 text-sm"
            onClick={onOpenSettings}
          >
            외부 연동 설정
          </button>
        )}
      </div>
    </div>
  );
}
