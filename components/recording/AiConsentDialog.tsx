"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { LlmProvider } from "@/lib/llm/types";
import type { SttProvider } from "@/lib/stt/types";
import {
  isCloudLlm,
  llmProviderLabel,
  sttProviderLabel,
} from "@/lib/types/settings";

type AiConsentDialogProps = {
  open: boolean;
  sttProvider: SttProvider;
  llmProvider: LlmProvider;
  llmConfigured: boolean;
  onSaveAudioOnly: () => void;
  onGenerateAi: () => void;
  onCancel: () => void;
};

function isCloudStt(provider: SttProvider) {
  return provider === "assemblyai";
}

export function AiConsentDialog({
  open,
  sttProvider,
  llmProvider,
  llmConfigured,
  onSaveAudioOnly,
  onGenerateAi,
  onCancel,
}: AiConsentDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [checked, setChecked] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setChecked(false);
      return;
    }
    checkboxRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const cloudStt = isCloudStt(sttProvider);
  const cloudLlm = llmConfigured && isCloudLlm(llmProvider);
  const localLlm = llmConfigured && !isCloudLlm(llmProvider);
  const sttName = sttProviderLabel(sttProvider);
  const llmName = llmProviderLabel(llmProvider);
  const hasExternal = cloudStt || cloudLlm;
  const fullyLocal = !cloudStt && localLlm;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.35)] p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="glass-panel w-full max-w-lg rounded-[var(--radius)] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          AI 회의록을 생성하시겠습니까?
        </h2>

        <div id={descriptionId} className="mt-4 space-y-4 text-sm leading-relaxed">
          <div className="rounded-xl bg-[var(--surface-raised)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              현재 엔진
            </p>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">STT</dt>
                <dd className="font-medium">
                  {sttName} ({cloudStt ? "클라우드" : "로컬"})
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">LLM</dt>
                <dd className="font-medium">
                  {llmConfigured
                    ? `${llmName} (${cloudLlm ? "클라우드" : "로컬"})`
                    : "미설정"}
                </dd>
              </div>
            </dl>
          </div>

          {fullyLocal ? (
            <div className="text-[var(--muted)]">
              <p>
                음성·전사문·메모는 이 기기(로컬 STT·LLM)에서만 처리되며 외부 AI
                서비스로 전송되지 않습니다.
              </p>
            </div>
          ) : hasExternal ? (
            <div className="text-[var(--muted)]">
              <p>
                AI 처리 과정에서 다음 데이터가 외부 AI 서비스로 전송됩니다.
              </p>
              {cloudStt && (
                <>
                  <p className="mt-3 font-medium text-[var(--foreground)]">
                    {sttName}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    <li>회의 음성</li>
                  </ul>
                </>
              )}
              {cloudLlm && (
                <>
                  <p className="mt-3 font-medium text-[var(--foreground)]">
                    {llmName}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    <li>전사문</li>
                    <li>‘AI 반영’으로 선택한 메모</li>
                    <li>생성에 사용하는 회의 정보·프롬프트</li>
                  </ul>
                </>
              )}
              {localLlm && (
                <p className="mt-3">
                  요약·상세는 로컬 {llmName}에서 처리됩니다.
                </p>
              )}
              {!llmConfigured && (
                <p className="mt-3">
                  LLM이 설정되지 않아 지금은 음성 인식(전사)만 실행합니다.
                </p>
              )}
            </div>
          ) : (
            <div className="text-[var(--muted)]">
              <p>
                음성은 이 기기의 로컬 STT 엔진에서만 처리되며 외부 AI 서비스로
                전송되지 않습니다.
              </p>
              <p className="mt-3">
                요약·상세 LLM이 설정되지 않아, 지금은 음성 인식(전사)만
                실행합니다. 설정에서 Ollama 또는 OpenAI를 연결해 주세요.
              </p>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-xl bg-white/50 px-3 py-3 ring-1 ring-[var(--border)]">
            <input
              ref={checkboxRef}
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span className="text-[var(--foreground)]">
              위 내용을 확인했습니다.
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost px-4 py-2"
            onClick={onSaveAudioOnly}
          >
            음성만 저장
          </button>
          <button
            type="button"
            className="btn btn-primary px-4 py-2"
            disabled={!checked}
            onClick={onGenerateAi}
          >
            AI 회의록 생성
          </button>
        </div>
      </div>
    </div>
  );
}
