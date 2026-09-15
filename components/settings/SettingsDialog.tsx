"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  SAMPLE_TRIAL_MEETING,
  SAMPLE_TRIAL_NOTES,
  SAMPLE_TRIAL_TRANSCRIPT,
} from "@/lib/mocks/sampleTrial";
import {
  exportMeetingBackup,
  getStorageEstimate,
  parseMeetingBackup,
  restoreMeetingBackup,
} from "@/lib/storage/backup";
import { getAppSettings, saveAppSettings } from "@/lib/storage/settings";
import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";
import {
  COMMON_TIMEZONES,
  DEFAULT_APP_SETTINGS,
  defaultPromptFor,
  isCloudLlm,
  llmProviderLabel,
  PROMPT_MAX_LENGTH,
  PROMPT_MIN_LENGTH,
  sttProviderLabel,
  validatePrompt,
  type AppSettings,
  type PromptKind,
} from "@/lib/types/settings";
import { formatBytes } from "@/lib/utils/format-time";

type EngineStatus = {
  configured: boolean;
  label: string;
  detail: string;
};

type SttStatusResponse = {
  engines: {
    assemblyai: EngineStatus;
    whisper: EngineStatus;
  };
};

type LlmStatusResponse = {
  engines: {
    openai: EngineStatus;
    ollama: EngineStatus;
  };
};

type SettingsTab =
  | "general"
  | "engines"
  | "prompts"
  | "backup"
  | "about";

type SettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "general", label: "일반" },
  { id: "engines", label: "AI 엔진" },
  { id: "prompts", label: "AI 프롬프트" },
  { id: "backup", label: "저장·백업" },
  { id: "about", label: "안내" },
];

const STT_OPTIONS: Array<{
  value: SttProvider;
  title: string;
  description: string;
}> = [
  {
    value: "assemblyai",
    title: "AssemblyAI",
    description: "클라우드 · 음성을 외부로 전송해 한국어 전사",
  },
  {
    value: "whisper",
    title: "Whisper (로컬)",
    description:
      "이 PC의 faster-whisper 서버(127.0.0.1:8080)에서 전사 · OpenAI 미사용",
  },
];

const LLM_OPTIONS: Array<{
  value: LlmProvider;
  title: string;
  description: string;
}> = [
  {
    value: "ollama",
    title: "Ollama (로컬)",
    description:
      "이 PC의 Ollama(127.0.0.1:11434)에서 요약·상세 생성 · 외부 전송 없음",
  },
  {
    value: "openai",
    title: "OpenAI",
    description: "클라우드 · 전사문·AI 반영 메모를 외부로 전송해 생성",
  },
];

type DraftState = {
  sttProvider: SttProvider;
  llmProvider: LlmProvider;
  timezone: string;
  askAiAfterRecording: boolean;
  summaryPrompt: string;
  detailPrompt: string;
  summaryPromptVersion: number;
  detailPromptVersion: number;
};

function toDraft(settings: AppSettings): DraftState {
  return {
    sttProvider: settings.sttProvider,
    llmProvider: settings.llmProvider,
    timezone: settings.timezone,
    askAiAfterRecording: settings.askAiAfterRecording,
    summaryPrompt: settings.summaryPrompt,
    detailPrompt: settings.detailPrompt,
    summaryPromptVersion: settings.summaryPromptVersion,
    detailPromptVersion: settings.detailPromptVersion,
  };
}

function draftsEqual(a: DraftState, b: DraftState): boolean {
  return (
    a.sttProvider === b.sttProvider &&
    a.llmProvider === b.llmProvider &&
    a.timezone === b.timezone &&
    a.askAiAfterRecording === b.askAiAfterRecording &&
    a.summaryPrompt === b.summaryPrompt &&
    a.detailPrompt === b.detailPrompt &&
    a.summaryPromptVersion === b.summaryPromptVersion &&
    a.detailPromptVersion === b.detailPromptVersion
  );
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<SettingsTab>("general");
  const [baseline, setBaseline] = useState<DraftState>(() =>
    toDraft(DEFAULT_APP_SETTINGS),
  );
  const [draft, setDraft] = useState<DraftState>(() =>
    toDraft(DEFAULT_APP_SETTINGS),
  );
  const [promptFocus, setPromptFocus] = useState<PromptKind>("summary");
  const [sttEngines, setSttEngines] = useState<
    SttStatusResponse["engines"] | null
  >(null);
  const [llmEngines, setLlmEngines] = useState<
    LlmStatusResponse["engines"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [restorePromptOpen, setRestorePromptOpen] = useState(false);
  const [trialConfirmOpen, setTrialConfirmOpen] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialResult, setTrialResult] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number }>({
    usage: 0,
    quota: 0,
  });
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const dirty = useMemo(
    () => !draftsEqual(draft, baseline),
    [draft, baseline],
  );

  const timezoneOptions = useMemo(() => {
    const browser =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "Asia/Seoul";
    return Array.from(
      new Set([browser, ...COMMON_TIMEZONES, draft.timezone]),
    ).filter(Boolean);
  }, [draft.timezone]);

  const activePrompt =
    promptFocus === "summary" ? draft.summaryPrompt : draft.detailPrompt;
  const promptError = validatePrompt(activePrompt);
  const promptLength = activePrompt.trim().length;

  function requestClose() {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSavedHint(null);
      setTrialResult(null);
      setBackupMessage(null);
      setBackupError(null);
      try {
        const [settings, sttRes, llmRes, estimate] = await Promise.all([
          getAppSettings(),
          fetch("/api/stt/status", { cache: "no-store" }),
          fetch("/api/llm/status", { cache: "no-store" }),
          getStorageEstimate(),
        ]);
        if (cancelled) return;

        const nextDraft = toDraft(settings);
        setBaseline(nextDraft);
        setDraft(nextDraft);
        setStorage(estimate);

        if (sttRes.ok) {
          const status = (await sttRes.json()) as SttStatusResponse;
          setSttEngines(status.engines);
        } else {
          setSttEngines(null);
        }

        if (llmRes.ok) {
          const status = (await llmRes.json()) as LlmStatusResponse;
          setLlmEngines(status.engines);
        } else {
          setLlmEngines(null);
        }
      } catch {
        if (!cancelled) setError("설정을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedHint(null);

    const summaryErr = validatePrompt(draft.summaryPrompt);
    const detailErr = validatePrompt(draft.detailPrompt);
    if (summaryErr || detailErr) {
      setTab("prompts");
      setError(
        [
          summaryErr ? `요약 프롬프트: ${summaryErr}` : null,
          detailErr ? `상세 프롬프트: ${detailErr}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
      setSaving(false);
      return;
    }

    const sttEngine = sttEngines?.[draft.sttProvider];
    if (sttEngine && !sttEngine.configured) {
      setTab("engines");
      setError(
        `${sttProviderLabel(draft.sttProvider)}가 서버에 설정되지 않아 저장할 수 없습니다.`,
      );
      setSaving(false);
      return;
    }

    const llmEngine = llmEngines?.[draft.llmProvider];
    if (llmEngine && !llmEngine.configured) {
      setTab("engines");
      setError(
        `${llmProviderLabel(draft.llmProvider)}에 연결할 수 없어 저장할 수 없습니다.`,
      );
      setSaving(false);
      return;
    }

    try {
      let summaryVersion = draft.summaryPromptVersion;
      let detailVersion = draft.detailPromptVersion;
      if (draft.summaryPrompt !== baseline.summaryPrompt) {
        summaryVersion = baseline.summaryPromptVersion + 1;
      }
      if (draft.detailPrompt !== baseline.detailPrompt) {
        detailVersion = baseline.detailPromptVersion + 1;
      }

      const saved = await saveAppSettings({
        sttProvider: draft.sttProvider,
        llmProvider: draft.llmProvider,
        timezone: draft.timezone,
        askAiAfterRecording: draft.askAiAfterRecording,
        theme: "default",
        summaryPrompt: draft.summaryPrompt,
        detailPrompt: draft.detailPrompt,
        summaryPromptVersion: summaryVersion,
        detailPromptVersion: detailVersion,
      });
      const next = toDraft(saved);
      setBaseline(next);
      setDraft(next);
      setSavedHint("설정을 저장했습니다.");
    } catch {
      setError("설정 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  function restoreActivePrompt() {
    setDraft((prev) =>
      promptFocus === "summary"
        ? { ...prev, summaryPrompt: defaultPromptFor("summary") }
        : { ...prev, detailPrompt: defaultPromptFor("detail") },
    );
    setRestorePromptOpen(false);
    setSavedHint(null);
  }

  async function runTrialGeneration() {
    setTrialConfirmOpen(false);
    setTrialBusy(true);
    setTrialResult(null);
    setError(null);
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: promptFocus === "summary" ? "summary" : "detail",
          provider: draft.llmProvider,
          meeting: SAMPLE_TRIAL_MEETING,
          transcript: SAMPLE_TRIAL_TRANSCRIPT,
          notes: SAMPLE_TRIAL_NOTES,
          summaryPrompt: draft.summaryPrompt,
          detailPrompt: draft.detailPrompt,
          summaryPromptVersion: draft.summaryPromptVersion,
          detailPromptVersion: draft.detailPromptVersion,
        }),
      });
      const data = (await res.json()) as {
        summaryText?: string;
        detailText?: string;
        error?: string;
        errors?: { summary?: string; detail?: string };
      };
      if (!res.ok && !data.summaryText && !data.detailText) {
        throw new Error(data.error || "시험 생성에 실패했습니다.");
      }
      const text =
        promptFocus === "summary"
          ? data.summaryText?.trim()
          : data.detailText?.trim();
      if (!text) {
        throw new Error(
          data.errors?.summary ||
            data.errors?.detail ||
            data.error ||
            "시험 생성 결과가 비어 있습니다.",
        );
      }
      setTrialResult(text);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "시험 생성에 실패했습니다.",
      );
    } finally {
      setTrialBusy(false);
    }
  }

  async function handleBackup() {
    setBackupError(null);
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
      setBackupMessage("백업 파일을 저장했습니다.");
    } catch {
      setBackupError("백업 파일을 만들지 못했습니다.");
    }
  }

  async function handleRestore(file: File) {
    setBackupError(null);
    setBackupMessage(null);
    try {
      const parsed = parseMeetingBackup(JSON.parse(await file.text()));
      await restoreMeetingBackup(parsed);
      const estimate = await getStorageEstimate();
      setStorage(estimate);
      setBackupMessage("백업 파일을 가져왔습니다. 같은 ID의 회의는 덮어씁니다.");
    } catch {
      setBackupError("백업 파일을 읽거나 복원하지 못했습니다.");
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.35)] p-4"
        onClick={requestClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="glass-panel flex max-h-[80vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[var(--radius)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              설정
            </h2>
            <button
              ref={closeRef}
              type="button"
              className="btn btn-ghost h-9 px-3 text-sm"
              onClick={requestClose}
            >
              닫기
            </button>
          </div>

          <div
            className="flex flex-wrap gap-1 border-b border-[var(--border)] px-4 py-2"
            role="tablist"
            aria-label="설정 탭"
          >
            {TABS.map((item) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="overflow-y-auto px-6 py-5">
            {tab === "general" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold">시간대</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    새 회의 생성·표시에 사용하는 시간대입니다.
                  </p>
                  <select
                    className="mt-3 w-full rounded-xl bg-white/80 px-3 py-2.5 text-sm outline-none ring-1 ring-[var(--border)]"
                    value={draft.timezone}
                    disabled={loading || saving}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        timezone: event.target.value,
                      }))
                    }
                  >
                    {timezoneOptions.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <h3 className="text-base font-semibold">녹음 종료 후 AI 안내</h3>
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl bg-white/40 px-4 py-3 ring-1 ring-[var(--border)]">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={draft.askAiAfterRecording}
                      disabled={loading || saving}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          askAiAfterRecording: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        녹음 종료 후 AI 회의록 생성 안내 표시
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        끄면 음성만 저장하고, 필요할 때 [AI 회의록 생성]으로
                        시작할 수 있습니다.
                      </span>
                    </span>
                  </label>
                </div>

                <div>
                  <h3 className="text-base font-semibold">화면 테마</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    기본 테마가 적용됩니다. 추가 테마 선택은 후속 기능입니다.
                  </p>
                  <p className="mt-3 rounded-xl bg-white/55 px-3 py-2 text-sm ring-1 ring-[var(--border)]">
                    기본 (현재 적용 중)
                  </p>
                </div>
              </div>
            )}

            {tab === "engines" && (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                  AI 엔진
                </p>
                <h3 className="mt-2 text-base font-semibold">
                  STT (음성 → 텍스트)
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  녹음 종료 후 전사에 사용할 엔진을 선택합니다. API 키는 서버
                  환경변수에만 보관됩니다.
                </p>

                <fieldset className="mt-4 space-y-2" disabled={loading || saving}>
                  <legend className="sr-only">STT 엔진 선택</legend>
                  {STT_OPTIONS.map((option) => {
                    const selected = draft.sttProvider === option.value;
                    const status = sttEngines?.[option.value];
                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer gap-3 rounded-2xl px-4 py-3 ring-1 transition-colors ${
                          selected
                            ? "bg-[var(--accent-soft)] ring-[var(--accent)]"
                            : "bg-white/40 ring-[var(--border)] hover:bg-white/70"
                        }`}
                      >
                        <input
                          type="radio"
                          name="sttProvider"
                          value={option.value}
                          checked={selected}
                          onChange={() =>
                            setDraft((prev) => ({
                              ...prev,
                              sttProvider: option.value,
                            }))
                          }
                          className="mt-1"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            {option.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">
                            {option.description}
                          </span>
                          {status && (
                            <span
                              className={`mt-1.5 block text-xs font-medium ${
                                status.configured
                                  ? "text-[var(--success)]"
                                  : "text-[var(--warning)]"
                              }`}
                            >
                              {status.detail}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>

                <h3 className="mt-8 text-base font-semibold">
                  LLM (요약 · 상세 회의록)
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  전사 후 요약·상세 생성에 사용할 엔진을 선택합니다.
                </p>

                <fieldset className="mt-4 space-y-2" disabled={loading || saving}>
                  <legend className="sr-only">LLM 엔진 선택</legend>
                  {LLM_OPTIONS.map((option) => {
                    const selected = draft.llmProvider === option.value;
                    const status = llmEngines?.[option.value];
                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer gap-3 rounded-2xl px-4 py-3 ring-1 transition-colors ${
                          selected
                            ? "bg-[var(--accent-soft)] ring-[var(--accent)]"
                            : "bg-white/40 ring-[var(--border)] hover:bg-white/70"
                        }`}
                      >
                        <input
                          type="radio"
                          name="llmProvider"
                          value={option.value}
                          checked={selected}
                          onChange={() =>
                            setDraft((prev) => ({
                              ...prev,
                              llmProvider: option.value,
                            }))
                          }
                          className="mt-1"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            {option.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">
                            {option.description}
                          </span>
                          {status && (
                            <span
                              className={`mt-1.5 block text-xs font-medium ${
                                status.configured
                                  ? "text-[var(--success)]"
                                  : "text-[var(--warning)]"
                              }`}
                            >
                              {status.detail}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              </div>
            )}

            {tab === "prompts" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold">AI 프롬프트</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    요약용·상세용 프롬프트를 따로 편집합니다. 시스템 규칙은
                    고정이며 여기서는 사용자 지시만 바꿉니다.
                  </p>
                </div>

                <div
                  className="flex rounded-xl bg-white/55 p-1 ring-1 ring-[var(--border)]"
                  role="tablist"
                  aria-label="프롬프트 종류"
                >
                  {(
                    [
                      { id: "summary" as const, label: "요약용" },
                      { id: "detail" as const, label: "상세용" },
                    ] as const
                  ).map((item) => {
                    const selected = promptFocus === item.id;
                    const version =
                      item.id === "summary"
                        ? draft.summaryPromptVersion
                        : draft.detailPromptVersion;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "text-[var(--muted)]"
                        }`}
                        onClick={() => setPromptFocus(item.id)}
                      >
                        {item.label} · v{version}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-[var(--muted)]">
                      {PROMPT_MIN_LENGTH}~{PROMPT_MAX_LENGTH}자 · 현재{" "}
                      <span
                        className={
                          promptError
                            ? "font-semibold text-[var(--danger)]"
                            : "font-[family-name:var(--font-mono)]"
                        }
                      >
                        {promptLength}
                      </span>
                      자
                    </p>
                    <button
                      type="button"
                      className="btn btn-ghost px-3 py-1.5 text-sm"
                      disabled={loading || saving}
                      onClick={() => setRestorePromptOpen(true)}
                    >
                      기본값 복원
                    </button>
                  </div>
                  <textarea
                    className="min-h-[220px] w-full rounded-2xl bg-white/80 px-3 py-3 text-sm leading-relaxed outline-none ring-1 ring-[var(--border)] focus:ring-[var(--border-strong)]"
                    value={activePrompt}
                    disabled={loading || saving}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDraft((prev) =>
                        promptFocus === "summary"
                          ? { ...prev, summaryPrompt: value }
                          : { ...prev, detailPrompt: value },
                      );
                    }}
                  />
                  {promptError && (
                    <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
                      {promptError}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-white/45 px-4 py-3 ring-1 ring-[var(--border)]">
                  <p className="text-sm font-semibold">샘플로 시험 생성</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    고정 샘플만 사용하며 실제 회의 데이터는 포함하지 않습니다.
                    현재 편집 중인 {promptFocus === "summary" ? "요약" : "상세"}{" "}
                    프롬프트로 {llmProviderLabel(draft.llmProvider)}를 호출합니다.
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost mt-3 px-3 py-1.5 text-sm"
                    disabled={loading || saving || trialBusy || Boolean(promptError)}
                    onClick={() => setTrialConfirmOpen(true)}
                  >
                    {trialBusy ? "시험 생성 중…" : "샘플로 시험 생성"}
                  </button>
                  {trialResult && (
                    <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-white/70 p-3 text-xs leading-relaxed">
                      {trialResult}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {tab === "backup" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold">저장·백업</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    회의·메모는 이 브라우저 IndexedDB에 저장됩니다. 아래 사용량은
                    회의 데이터 추정값이며, 전체 자동 백업을 의미하지 않습니다.
                  </p>
                </div>
                <p className="rounded-xl bg-white/55 px-3 py-2 text-sm ring-1 ring-[var(--border)]">
                  회의 데이터 {formatBytes(storage.usage)}
                  {storage.quota > 0
                    ? ` · 브라우저 한도 ${formatBytes(storage.quota)}`
                    : ""}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
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
                {backupMessage && (
                  <p className="text-sm text-[var(--success)]">{backupMessage}</p>
                )}
                {backupError && (
                  <p className="text-sm text-[var(--danger)]">{backupError}</p>
                )}
              </div>
            )}

            {tab === "about" && (
              <div className="space-y-4 text-sm leading-relaxed text-[var(--muted)]">
                <h3 className="text-base font-semibold text-[var(--foreground)]">
                  데이터 처리 안내
                </h3>
                <p>
                  회의 녹음·메모·전사·AI 결과는 기본적으로 이 브라우저의
                  IndexedDB에만 저장됩니다.
                </p>
                <p>
                  Whisper·Ollama를 선택하면 음성·전사문이 이 PC에서만
                  처리됩니다. AssemblyAI·OpenAI를 선택하면 해당 클라우드로
                  데이터가 전송되며, 실행 전 동의 화면에서 안내합니다.
                </p>
                <p>
                  API 키는 화면·백업 파일에 포함되지 않으며 서버 환경변수에만
                  보관됩니다.
                </p>
                <p>
                  외부 연동(웹훅)은 `.env.local`의 `MAKE_WEBHOOK_URL`로
                  설정합니다. 검토 화면의 외부 연동 탭에서 확정본을
                  마크다운으로 전송할 수 있습니다.
                </p>
              </div>
            )}

            {loading && (
              <p className="mt-4 text-sm text-[var(--muted)]">설정 불러오는 중…</p>
            )}
            {error && (
              <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            )}
            {savedHint && (
              <p className="mt-4 text-sm text-[var(--accent)]" role="status">
                {savedHint}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
            <button
              type="button"
              className="btn btn-ghost px-4 py-2"
              onClick={requestClose}
            >
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary px-4 py-2"
              disabled={loading || saving || !dirty}
              onClick={() => void handleSave()}
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={discardOpen}
        title="변경사항을 폐기할까요?"
        description="저장하지 않은 설정 변경이 있습니다. 닫으면 편집 내용이 사라집니다."
        confirmLabel="폐기하고 닫기"
        cancelLabel="계속 편집"
        danger
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          setDraft(baseline);
          onClose();
        }}
      />

      <ConfirmDialog
        open={restorePromptOpen}
        title="기본 프롬프트로 복원할까요?"
        description={
          promptFocus === "summary"
            ? "현재 편집 중인 요약용 프롬프트만 기본값으로 되돌립니다. 저장 버튼을 눌러야 반영됩니다."
            : "현재 편집 중인 상세용 프롬프트만 기본값으로 되돌립니다. 저장 버튼을 눌러야 반영됩니다."
        }
        confirmLabel="기본값으로 되돌리기"
        onCancel={() => setRestorePromptOpen(false)}
        onConfirm={restoreActivePrompt}
      />

      <ConfirmDialog
        open={trialConfirmOpen}
        title="샘플로 시험 생성"
        description={
          isCloudLlm(draft.llmProvider)
            ? "실제 OpenAI API를 호출하며 비용이 발생할 수 있습니다. 실제 회의 데이터는 사용하지 않습니다."
            : "로컬 Ollama를 호출합니다. 실제 회의 데이터는 사용하지 않습니다."
        }
        confirmLabel="시험 생성"
        onCancel={() => setTrialConfirmOpen(false)}
        onConfirm={() => void runTrialGeneration()}
      />
    </>
  );
}
