"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getAppSettings, saveAppSettings } from "@/lib/storage/settings";
import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";
import {
  llmProviderLabel,
  sttProviderLabel,
} from "@/lib/types/settings";

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

type SettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

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

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [sttProvider, setSttProvider] = useState<SttProvider>("whisper");
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("ollama");
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

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSavedHint(null);
      try {
        const [settings, sttRes, llmRes] = await Promise.all([
          getAppSettings(),
          fetch("/api/stt/status", { cache: "no-store" }),
          fetch("/api/llm/status", { cache: "no-store" }),
        ]);
        if (cancelled) return;

        setSttProvider(settings.sttProvider);
        setLlmProvider(settings.llmProvider);

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
        if (!cancelled) {
          setError("설정을 불러오지 못했습니다.");
        }
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

    const sttEngine = sttEngines?.[sttProvider];
    if (sttEngine && !sttEngine.configured) {
      setError(
        `${sttProviderLabel(sttProvider)}가 서버에 설정되지 않아 저장할 수 없습니다.`,
      );
      setSaving(false);
      return;
    }

    const llmEngine = llmEngines?.[llmProvider];
    if (llmEngine && !llmEngine.configured) {
      setError(
        `${llmProviderLabel(llmProvider)}에 연결할 수 없어 저장할 수 없습니다.`,
      );
      setSaving(false);
      return;
    }

    try {
      await saveAppSettings({ sttProvider, llmProvider });
      setSavedHint(
        `STT ${sttProviderLabel(sttProvider)} · LLM ${llmProviderLabel(llmProvider)}로 저장했습니다.`,
      );
    } catch {
      setError("설정 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.35)] p-4"
      onClick={onClose}
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
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            AI 엔진
          </p>
          <h3 className="mt-2 text-base font-semibold">STT (음성 → 텍스트)</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            녹음 종료 후 전사에 사용할 엔진을 선택합니다. API 키는 서버
            환경변수에만 보관됩니다.
          </p>

          <fieldset className="mt-4 space-y-2" disabled={loading || saving}>
            <legend className="sr-only">STT 엔진 선택</legend>
            {STT_OPTIONS.map((option) => {
              const selected = sttProvider === option.value;
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
                    onChange={() => setSttProvider(option.value)}
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
              const selected = llmProvider === option.value;
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
                    onChange={() => setLlmProvider(option.value)}
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
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary px-4 py-2"
            disabled={loading || saving}
            onClick={() => void handleSave()}
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
