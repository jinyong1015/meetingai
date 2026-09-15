"use client";

import { useEffect, useState, type ReactNode } from "react";
import type {
  DetailActionItem,
  DetailAgendaItem,
  MeetingDetailMinutes,
} from "@/lib/types/detail";
import type { EvidenceRef } from "@/lib/types/evidence";
import { formatTimestamp } from "@/lib/utils/format-time";

type DetailPanelProps = {
  detailMinutes: MeetingDetailMinutes | null;
  detailText?: string | null;
  pending?: boolean;
  sourceLabel?: string | null;
  onSave?: (next: MeetingDetailMinutes) => Promise<void> | void;
  onRegenerate?: () => void;
  onOpenEvidence?: (evidence: EvidenceRef) => void;
  showAiOriginalToggle?: boolean;
  viewingAiOriginal?: boolean;
  onToggleAiOriginal?: () => void;
};

const fieldClassName =
  "w-full rounded-xl bg-white/80 px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-[box-shadow] placeholder:text-[var(--muted)] focus:ring-[var(--border-strong)] focus:shadow-[0_0_0_4px_var(--accent-soft)]";

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium leading-snug text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
      {children}
    </label>
  );
}

function cloneDetail(detail: MeetingDetailMinutes): MeetingDetailMinutes {
  return structuredClone(detail);
}

function emptyAgenda(): DetailAgendaItem {
  return {
    title: "",
    discussions: [{ speaker: null, content: "" }],
    decisions: [{ text: "" }],
    actionItems: [{ task: "", owner: null, due: "" }],
  };
}

function normalizeDetail(draft: MeetingDetailMinutes): MeetingDetailMinutes {
  return {
    ...draft,
    documentTitle: draft.documentTitle.trim(),
    meetingTitle: draft.meetingTitle.trim(),
    datetime: draft.datetime.trim(),
    location: draft.location.trim(),
    host: draft.host.trim(),
    purpose: draft.purpose.trim(),
    attendees: draft.attendees.map((name) => name.trim()).filter(Boolean),
    nextMeeting: draft.nextMeeting?.trim() || null,
    additionalItems: draft.additionalItems
      .map((item) => item.trim())
      .filter(Boolean),
    agendas: draft.agendas.map((agenda) => ({
      title: agenda.title.trim(),
      discussions: agenda.discussions
        .map((item) => ({
          speaker: null,
          content: item.content.trim(),
        }))
        .filter((item) => item.content),
      decisions: agenda.decisions
        .map((item) => ({
          text: item.text.trim(),
          evidence: item.evidence ?? null,
          needsReview: item.needsReview,
        }))
        .filter((item) => item.text),
      actionItems: agenda.actionItems
        .map((item) => ({
          task: item.task.trim(),
          owner: null,
          due: item.due?.trim() || null,
          evidence: item.evidence ?? null,
          needsReview: item.needsReview,
        }))
        .filter((item) => item.task),
    })),
  };
}

function EvidenceButton({
  evidence,
  onOpen,
}: {
  evidence?: EvidenceRef | null;
  onOpen?: (evidence: EvidenceRef) => void;
}) {
  if (!evidence || !onOpen) return null;
  const label =
    evidence.startTimeSec != null
      ? `근거 [${formatTimestamp(evidence.startTimeSec)}]`
      : "근거";
  return (
    <button
      type="button"
      className="btn btn-ghost px-2 py-1 text-xs text-[var(--accent)]"
      onClick={() => onOpen(evidence)}
    >
      {label}
    </button>
  );
}

function isCurrentDetailShape(
  detail: MeetingDetailMinutes,
): detail is MeetingDetailMinutes {
  const first = detail.agendas?.[0];
  return (
    typeof detail.documentTitle === "string" &&
    Array.isArray(detail.attendees) &&
    (!first || Array.isArray(first.discussions))
  );
}

function LineListEditor({
  label,
  values,
  placeholder,
  onChange,
  onAdd,
  onRemove,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={`${label}-${index}`} className="flex gap-2">
            <input
              value={value}
              onChange={(e) => onChange(index, e.target.value)}
              placeholder={placeholder}
              className={fieldClassName}
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="btn btn-ghost shrink-0 px-2.5 py-2 text-xs"
              aria-label={`${label} 항목 삭제`}
            >
              삭제
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="btn btn-ghost px-3 py-1.5 text-xs"
        >
          + 항목 추가
        </button>
      </div>
    </div>
  );
}

function ActionListEditor({
  values,
  onChange,
  onAdd,
  onRemove,
}: {
  values: DetailActionItem[];
  onChange: (index: number, next: DetailActionItem) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div>
      <FieldLabel>액션 아이템</FieldLabel>
      <div className="space-y-2">
        {values.map((item, index) => (
          <div
            key={`action-${index}`}
            className="grid gap-2 rounded-xl bg-[var(--warning-soft)]/50 p-3 ring-1 ring-[var(--border)] sm:grid-cols-[minmax(0,1fr)_160px_auto]"
          >
            <input
              value={item.task}
              onChange={(e) => onChange(index, { ...item, task: e.target.value })}
              placeholder="할 일"
              className={fieldClassName}
            />
            <input
              value={item.due ?? ""}
              onChange={(e) => onChange(index, { ...item, due: e.target.value })}
              placeholder="기한"
              className={fieldClassName}
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="btn btn-ghost px-2.5 py-2 text-xs"
              aria-label="액션 아이템 삭제"
            >
              삭제
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="btn btn-ghost px-3 py-1.5 text-xs"
        >
          + 액션 추가
        </button>
      </div>
    </div>
  );
}

export function DetailPanel({
  detailMinutes,
  detailText = null,
  pending = false,
  sourceLabel = null,
  onSave,
  onRegenerate,
  onOpenEvidence,
  showAiOriginalToggle = false,
  viewingAiOriginal = false,
  onToggleAiOriginal,
}: DetailPanelProps) {
  const fallback = detailText?.trim() ?? "";
  const showStructured =
    detailMinutes != null && isCurrentDetailShape(detailMinutes);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MeetingDetailMinutes | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(null);
  }, [detailMinutes, editing]);

  function startEditing() {
    if (!detailMinutes || !onSave) return;
    setSaveError(null);
    setDraft(cloneDetail(detailMinutes));
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!draft || !onSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = normalizeDetail(draft);
      await onSave(next);
      setEditing(false);
      setDraft(null);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "상세 회의록 저장에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(patch: Partial<MeetingDetailMinutes>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateAgenda(index: number, next: DetailAgendaItem) {
    setDraft((prev) => {
      if (!prev) return prev;
      const agendas = [...prev.agendas];
      agendas[index] = next;
      return { ...prev, agendas };
    });
  }

  return (
    <div aria-label="상세 회의록">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
            상세 회의록
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            회의 정보·안건별 논의·결정·액션을 한눈에 확인합니다
            {sourceLabel ? ` · ${sourceLabel}` : ""}
          </p>
        </div>
        {(onRegenerate ||
          (showStructured && onSave) ||
          showAiOriginalToggle) &&
          !pending && (
          <div className="flex flex-wrap items-center gap-2">
            {showAiOriginalToggle && onToggleAiOriginal && !editing && (
              <button
                type="button"
                onClick={onToggleAiOriginal}
                className="btn btn-ghost px-3 py-1.5 text-sm"
              >
                {viewingAiOriginal ? "사용자 수정본" : "AI 생성본"}
              </button>
            )}
            {onRegenerate && !editing && !viewingAiOriginal && (
              <button
                type="button"
                onClick={onRegenerate}
                className="btn btn-ghost px-3 py-1.5 text-sm"
              >
                상세만 재생성
              </button>
            )}
            {showStructured && onSave && !viewingAiOriginal && (
              editing ? (
              <>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="btn btn-ghost px-3 py-1.5 text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="btn btn-primary px-3 py-1.5 text-sm"
                >
                  {saving ? "저장 중…" : "저장"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className="btn btn-ghost px-3 py-1.5 text-sm"
              >
                수정
              </button>
            )
            )}
          </div>
        )}
      </div>

      {saveError && (
        <p className="mb-4 text-sm text-[var(--danger)]" role="alert">
          {saveError}
        </p>
      )}

      {pending ? (
        <p className="text-sm text-[var(--accent)]" role="status">
          상세 회의록을 생성하는 중…
        </p>
      ) : editing && draft ? (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <div>
            <FieldLabel>문서 제목</FieldLabel>
            <input
              value={draft.documentTitle}
              onChange={(e) => updateDraft({ documentTitle: e.target.value })}
              className={fieldClassName}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>회의 제목</FieldLabel>
              <input
                value={draft.meetingTitle}
                onChange={(e) => updateDraft({ meetingTitle: e.target.value })}
                className={fieldClassName}
              />
            </div>
            <div>
              <FieldLabel>회의 일시</FieldLabel>
              <input
                value={draft.datetime}
                onChange={(e) => updateDraft({ datetime: e.target.value })}
                className={fieldClassName}
              />
            </div>
            <div>
              <FieldLabel>장소</FieldLabel>
              <input
                value={draft.location}
                onChange={(e) => updateDraft({ location: e.target.value })}
                className={fieldClassName}
              />
            </div>
            <div>
              <FieldLabel>주최자</FieldLabel>
              <input
                value={draft.host}
                onChange={(e) => updateDraft({ host: e.target.value })}
                className={fieldClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>회의 목적</FieldLabel>
              <input
                value={draft.purpose}
                onChange={(e) => updateDraft({ purpose: e.target.value })}
                className={fieldClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>참석자 (쉼표로 구분)</FieldLabel>
              <input
                value={draft.attendees.join(", ")}
                onChange={(e) =>
                  updateDraft({
                    attendees: e.target.value
                      .split(",")
                      .map((name) => name.trim())
                      .filter(Boolean),
                  })
                }
                className={fieldClassName}
              />
            </div>
          </div>

          <div className="space-y-5">
            {draft.agendas.map((agenda, agendaIndex) => (
              <section
                key={`edit-agenda-${agendaIndex}`}
                className="space-y-4 rounded-[14px] bg-white/55 p-4 ring-1 ring-[var(--border)] sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    안건 {agendaIndex + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              agendas: prev.agendas.filter(
                                (_, i) => i !== agendaIndex,
                              ),
                            }
                          : prev,
                      )
                    }
                    className="btn btn-ghost px-2.5 py-1.5 text-xs"
                  >
                    안건 삭제
                  </button>
                </div>

                <div>
                  <FieldLabel>안건 제목</FieldLabel>
                  <input
                    value={agenda.title}
                    onChange={(e) =>
                      updateAgenda(agendaIndex, {
                        ...agenda,
                        title: e.target.value,
                      })
                    }
                    className={fieldClassName}
                  />
                </div>

                <LineListEditor
                  label="논의 내용"
                  values={agenda.discussions.map((item) => item.content)}
                  placeholder="논의 내용을 입력하세요"
                  onChange={(index, value) => {
                    const discussions = [...agenda.discussions];
                    discussions[index] = {
                      speaker: null,
                      content: value,
                    };
                    updateAgenda(agendaIndex, { ...agenda, discussions });
                  }}
                  onAdd={() =>
                    updateAgenda(agendaIndex, {
                      ...agenda,
                      discussions: [
                        ...agenda.discussions,
                        { speaker: null, content: "" },
                      ],
                    })
                  }
                  onRemove={(index) =>
                    updateAgenda(agendaIndex, {
                      ...agenda,
                      discussions: agenda.discussions.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                />

                <LineListEditor
                  label="결정 사항"
                  values={agenda.decisions.map((item) => item.text)}
                  placeholder="결정 사항을 입력하세요"
                  onChange={(index, value) => {
                    const decisions = [...agenda.decisions];
                    const prev = decisions[index] ?? { text: "" };
                    decisions[index] = { ...prev, text: value };
                    updateAgenda(agendaIndex, { ...agenda, decisions });
                  }}
                  onAdd={() =>
                    updateAgenda(agendaIndex, {
                      ...agenda,
                      decisions: [...agenda.decisions, { text: "" }],
                    })
                  }
                  onRemove={(index) =>
                    updateAgenda(agendaIndex, {
                      ...agenda,
                      decisions: agenda.decisions.filter((_, i) => i !== index),
                    })
                  }
                />

                <ActionListEditor
                  values={agenda.actionItems}
                  onChange={(index, next) => {
                    const actionItems = [...agenda.actionItems];
                    actionItems[index] = next;
                    updateAgenda(agendaIndex, { ...agenda, actionItems });
                  }}
                  onAdd={() =>
                    updateAgenda(agendaIndex, {
                      ...agenda,
                      actionItems: [
                        ...agenda.actionItems,
                        { task: "", owner: null, due: "" },
                      ],
                    })
                  }
                  onRemove={(index) =>
                    updateAgenda(agendaIndex, {
                      ...agenda,
                      actionItems: agenda.actionItems.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                />
              </section>
            ))}

            <button
              type="button"
              onClick={() =>
                setDraft((prev) =>
                  prev
                    ? { ...prev, agendas: [...prev.agendas, emptyAgenda()] }
                    : prev,
                )
              }
              className="btn btn-ghost px-3 py-2 text-sm"
            >
              + 안건 추가
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>다음 회의 일정</FieldLabel>
              <input
                value={draft.nextMeeting ?? ""}
                onChange={(e) => updateDraft({ nextMeeting: e.target.value })}
                className={fieldClassName}
              />
            </div>
            <div>
              <LineListEditor
                label="추가 논의 사항"
                values={
                  draft.additionalItems.length > 0
                    ? draft.additionalItems
                    : [""]
                }
                placeholder="추가 논의 사항"
                onChange={(index, value) => {
                  const additionalItems = [
                    ...(draft.additionalItems.length > 0
                      ? draft.additionalItems
                      : [""]),
                  ];
                  additionalItems[index] = value;
                  updateDraft({ additionalItems });
                }}
                onAdd={() =>
                  updateDraft({
                    additionalItems: [...draft.additionalItems, ""],
                  })
                }
                onRemove={(index) =>
                  updateDraft({
                    additionalItems: draft.additionalItems.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              />
            </div>
          </div>
        </form>
      ) : showStructured && detailMinutes ? (
        <article className="space-y-6">
          <header className="border-b border-[var(--border)] pb-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent)]">
              상세 회의록
            </p>
            <h4 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-[1.75rem]">
              {detailMinutes.documentTitle}
            </h4>
          </header>

          <section aria-label="회의 기본 정보">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetaRow label="회의 제목" value={detailMinutes.meetingTitle} />
              <MetaRow label="회의 일시" value={detailMinutes.datetime} />
              <MetaRow label="장소" value={detailMinutes.location} />
              <MetaRow label="주최자" value={detailMinutes.host} />
              <MetaRow label="회의 목적" value={detailMinutes.purpose} />
              <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  참석자
                </dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {detailMinutes.attendees.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]"
                    >
                      {name}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          <div className="space-y-5">
            {detailMinutes.agendas.map((agenda, index) => (
              <section
                key={`${agenda.title}-${index}`}
                className="overflow-hidden rounded-[14px] bg-white/55 ring-1 ring-[var(--border)]"
              >
                <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)]/80 px-4 py-3 sm:px-5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      안건 {index + 1}
                    </p>
                    <h5 className="truncate font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
                      {agenda.title}
                    </h5>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-4 sm:px-5">
                  <div>
                    <SectionLabel>논의 내용</SectionLabel>
                    <ul className="space-y-2">
                      {agenda.discussions.map((item) => (
                        <li
                          key={item.content}
                          className="text-sm leading-relaxed text-[var(--foreground)]"
                        >
                          {item.content}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {agenda.decisions.length > 0 && (
                    <div className="rounded-xl bg-[var(--success-soft)] px-3.5 py-3 ring-1 ring-[var(--border)]">
                      <SectionLabel>결정 사항</SectionLabel>
                      <ul className="space-y-1.5">
                        {agenda.decisions.map((item) => (
                          <li
                            key={item.text}
                            className="flex flex-wrap items-start justify-between gap-2 text-sm font-medium leading-relaxed text-[var(--success)]"
                          >
                            <span className="flex min-w-0 gap-2">
                              <span aria-hidden className="mt-0.5 shrink-0">
                                ✓
                              </span>
                              <span>
                                {item.text}
                                {item.needsReview ? (
                                  <span className="ml-2 text-xs text-[var(--warning)]">
                                    확인 필요
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <EvidenceButton
                              evidence={item.evidence}
                              onOpen={onOpenEvidence}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {agenda.actionItems.length > 0 && (
                    <div>
                      <SectionLabel>액션 아이템</SectionLabel>
                      <ul className="space-y-2">
                        {agenda.actionItems.map((item) => (
                          <li
                            key={item.task}
                            className="flex flex-col gap-2 rounded-xl bg-[var(--warning-soft)]/70 px-3.5 py-3 ring-1 ring-[var(--border)] sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--foreground)]">
                                {item.task}
                                {item.needsReview ? (
                                  <span className="ml-2 text-xs font-medium text-[var(--warning)]">
                                    확인 필요
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-lg bg-white/80 px-2.5 py-1 text-xs font-semibold text-[var(--warning)] ring-1 ring-[var(--border)]">
                                기한 {item.due?.trim() || "미정"}
                              </span>
                              <EvidenceButton
                                evidence={item.evidence}
                                onOpen={onOpenEvidence}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>

          <footer className="grid gap-3 border-t border-[var(--border)] pt-5 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 ring-1 ring-[var(--border)]">
              <SectionLabel>다음 회의 일정</SectionLabel>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {detailMinutes.nextMeeting?.trim() || "미정"}
              </p>
            </div>
            <div className="rounded-xl bg-white/55 px-4 py-3 ring-1 ring-[var(--border)]">
              <SectionLabel>추가 논의 사항</SectionLabel>
              {detailMinutes.additionalItems.length > 0 ? (
                <ul className="space-y-1">
                  {detailMinutes.additionalItems.map((item) => (
                    <li key={item} className="text-sm font-medium">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--muted)]">없음</p>
              )}
            </div>
          </footer>
        </article>
      ) : fallback ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{fallback}</p>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          상세 회의록이 아직 생성되지 않았습니다. 가상 데이터 미리보기를
          실행하거나, 녹음 후 AI 상세 회의록을 생성해 주세요.
        </p>
      )}
    </div>
  );
}
