"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  canCancelWebhookDelivery,
  canRetryWebhookDelivery,
  describeIncludeFlags,
  webhookStatusLabel,
  type WebhookDelivery,
  type WebhookIncludeFlags,
} from "@/lib/types/webhook";
import { formatMeetingDateTime } from "@/lib/utils/format-time";

type IntegrationsPanelProps = {
  confirmed: boolean;
  confirmedVersionNumber: number | null;
  webhookEnabled: boolean;
  destinationAlias: string;
  includeFlags: WebhookIncludeFlags;
  deliveries: WebhookDelivery[];
  busyDeliveryId?: string | null;
  sendConfirmOpen?: boolean;
  onRequestSend?: () => void;
  onCancelSendConfirm?: () => void;
  onConfirmSend?: () => void;
  onCancelDelivery?: (id: string) => void;
  onRetryDelivery?: (id: string) => void;
  onOpenSettings?: () => void;
};

export function IntegrationsPanel({
  confirmed,
  confirmedVersionNumber,
  webhookEnabled,
  destinationAlias,
  includeFlags,
  deliveries,
  busyDeliveryId = null,
  sendConfirmOpen = false,
  onRequestSend,
  onCancelSendConfirm,
  onConfirmSend,
  onCancelDelivery,
  onRetryDelivery,
  onOpenSettings,
}: IntegrationsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { included, excluded } = useMemo(
    () => describeIncludeFlags(includeFlags),
    [includeFlags],
  );

  const canSend =
    confirmed &&
    webhookEnabled &&
    Boolean(onRequestSend) &&
    confirmedVersionNumber != null &&
    !busyDeliveryId;

  const latestForVersion =
    confirmedVersionNumber != null
      ? deliveries.find((d) => d.approvedVersion === confirmedVersionNumber)
      : undefined;

  return (
    <div aria-label="외부 연동">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
            외부 연동
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            확정된 회의록을 등록된 웹훅 수신처로 전송하고 이력을 관리합니다
          </p>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            className="btn btn-ghost px-3 py-1.5 text-sm"
            onClick={onOpenSettings}
          >
            설정
          </button>
        )}
      </div>

      <dl className="mt-5 space-y-3 rounded-xl bg-white/55 px-4 py-4 ring-1 ring-[var(--border)]">
        <div>
          <dt className="text-xs text-[var(--muted)]">웹훅</dt>
          <dd className="mt-1 text-sm font-medium">
            {webhookEnabled ? "ON" : "OFF"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">현재 확정 버전</dt>
          <dd className="mt-1 text-sm font-medium">
            {confirmed && confirmedVersionNumber != null
              ? `v${confirmedVersionNumber}`
              : "없음"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">수신처</dt>
          <dd className="mt-1 text-sm font-medium">{destinationAlias}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">포함</dt>
          <dd className="mt-1 text-sm font-medium">
            {included.length > 0 ? included.join(" / ") : "없음"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">제외</dt>
          <dd className="mt-1 text-sm font-medium text-[var(--muted)]">
            {excluded.length > 0 ? excluded.join(" / ") : "없음"}
            {" · "}음성 전송은 지원하지 않습니다
          </dd>
        </div>
        {latestForVersion && (
          <div>
            <dt className="text-xs text-[var(--muted)]">현재 버전 발송</dt>
            <dd className="mt-1 text-sm font-medium">
              {webhookStatusLabel(latestForVersion.status)}
              {latestForVersion.lastHttpStatus != null
                ? ` · HTTP ${latestForVersion.lastHttpStatus}`
                : ""}
            </dd>
          </div>
        )}
      </dl>

      {!webhookEnabled && (
        <p className="mt-4 text-sm text-[var(--muted)]">
          웹훅이 꺼져 있습니다. 설정에서 외부 연동을 켠 뒤 전송할 수 있습니다.
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
          onClick={onRequestSend}
        >
          {busyDeliveryId ? "처리 중…" : "확정본 전송"}
        </button>
      </div>

      <div className="mt-8">
        <h4 className="text-sm font-semibold">전송 이력</h4>
        {deliveries.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            아직 전송 이력이 없습니다.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {deliveries.map((delivery) => {
              const expanded = expandedId === delivery.id;
              return (
                <li key={delivery.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        버전 v{delivery.approvedVersion} ·{" "}
                        {webhookStatusLabel(delivery.status)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatMeetingDateTime(delivery.createdAt)} ·{" "}
                        {delivery.destinationAlias}
                        {delivery.lastHttpStatus != null
                          ? ` · HTTP ${delivery.lastHttpStatus}`
                          : ""}
                        {` · ${delivery.attemptCount}회 시도`}
                      </p>
                      {delivery.status === "retry_wait" &&
                        delivery.nextRetryAt && (
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            다음 시도{" "}
                            {formatMeetingDateTime(delivery.nextRetryAt)}
                          </p>
                        )}
                      {delivery.lastError &&
                        (delivery.status === "failed" ||
                          delivery.status === "retry_wait") && (
                          <p className="mt-1 text-xs text-[var(--danger)]">
                            {delivery.lastError}
                          </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="btn btn-ghost px-2.5 py-1 text-xs"
                        onClick={() =>
                          setExpandedId(expanded ? null : delivery.id)
                        }
                      >
                        {expanded ? "접기" : "상세"}
                      </button>
                      {canCancelWebhookDelivery(delivery.status) &&
                        onCancelDelivery && (
                          <button
                            type="button"
                            className="btn btn-ghost px-2.5 py-1 text-xs"
                            disabled={busyDeliveryId === delivery.id}
                            onClick={() => onCancelDelivery(delivery.id)}
                          >
                            대기 취소
                          </button>
                        )}
                      {canRetryWebhookDelivery(delivery.status) &&
                        onRetryDelivery && (
                          <button
                            type="button"
                            className="btn btn-ghost px-2.5 py-1 text-xs"
                            disabled={busyDeliveryId === delivery.id}
                            onClick={() => onRetryDelivery(delivery.id)}
                          >
                            수동 재전송
                          </button>
                        )}
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-3 rounded-lg bg-white/60 px-3 py-3 text-xs text-[var(--muted)] ring-1 ring-[var(--border)]">
                      <p>
                        event_id:{" "}
                        <span className="font-mono text-[var(--foreground)]">
                          {delivery.eventId}
                        </span>
                      </p>
                      <p className="mt-1">
                        포함:{" "}
                        {describeIncludeFlags(delivery.includeFlags).included.join(
                          " / ",
                        ) || "없음"}
                      </p>
                      {delivery.attempts.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {delivery.attempts.map((attempt) => (
                            <li key={attempt.attemptNumber}>
                              {attempt.attemptNumber}차 ·{" "}
                              {formatMeetingDateTime(attempt.finishedAt)}
                              {attempt.httpStatus != null
                                ? ` · HTTP ${attempt.httpStatus}`
                                : ""}
                              {attempt.responseTimeMs != null
                                ? ` · ${attempt.responseTimeMs}ms`
                                : ""}
                              {attempt.ok ? " · 성공" : " · 실패"}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={sendConfirmOpen}
        title="확정본을 전송할까요?"
        description={[
          "실제 확정 회의록이 외부 수신처로 전송됩니다.",
          "",
          `수신처\n${destinationAlias}`,
          "",
          `확정 버전\nv${confirmedVersionNumber ?? "-"}`,
          "",
          `전송 내용\n${included.map((label) => `✓ ${label}`).join("\n") || "(선택 항목 없음)"}`,
          excluded.length > 0 ? `\n제외\n${excluded.join(" / ")}` : "",
          "",
          "음성 파일은 전송하지 않습니다.",
        ]
          .filter(Boolean)
          .join("\n")}
        confirmLabel="확정본 전송"
        cancelLabel="전송하지 않음"
        onCancel={() => onCancelSendConfirm?.()}
        onConfirm={() => onConfirmSend?.()}
      />
    </div>
  );
}
