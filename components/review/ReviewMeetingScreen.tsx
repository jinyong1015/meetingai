"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { NoteSection } from "@/components/note/NoteSection";
import { AudioPlayer } from "@/components/recording/AudioPlayer";
import { EvidencePanel } from "@/components/review/EvidencePanel";
import { MeetingResultTabs } from "@/components/review/MeetingResultTabs";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { buildGenerationInputFingerprint } from "@/lib/review/inputFingerprint";
import { resolveEvidence } from "@/lib/review/resolveEvidence";
import { loadPlayableMeetingAudio } from "@/lib/storage/audio";
import {
  getMeetingGeneration,
  saveMeetingGeneration,
} from "@/lib/storage/generations";
import { getMeeting, patchMeeting } from "@/lib/storage/meetings";
import { getNotesByMeeting } from "@/lib/storage/notes";
import { getAppSettings } from "@/lib/storage/settings";
import {
  getMeetingTranscript,
  saveMeetingTranscript,
} from "@/lib/storage/transcripts";
import {
  createGenerationVersion,
  listGenerationVersions,
} from "@/lib/storage/versions";
import { listWebhookDeliveries } from "@/lib/storage/webhookDeliveries";
import {
  countNeedsReview,
  formatDetailMinutesText,
  type MeetingDetailMinutes,
} from "@/lib/types/detail";
import type { EvidenceRef } from "@/lib/types/evidence";
import type {
  GenerationSource,
  MeetingResultTab,
} from "@/lib/types/generation";
import type { Meeting } from "@/lib/types/meeting";
import type { Note } from "@/lib/types/note";
import {
  SETTINGS_CHANGED_EVENT,
  sttProviderLabel,
  type AppSettings,
} from "@/lib/types/settings";
import type { TranscriptSegment } from "@/lib/types/transcript";
import type { GenerationVersion } from "@/lib/types/version";
import {
  DEFAULT_WEBHOOK_DESTINATION_ALIAS,
  DEFAULT_WEBHOOK_INCLUDE_FLAGS,
  includeFlagsFromSettings,
  type WebhookDelivery,
  type WebhookIncludeFlags,
} from "@/lib/types/webhook";
import { createId, formatMeetingDateTime } from "@/lib/utils/format-time";
import { buildWebhookPayload } from "@/lib/webhook/buildPayload";
import {
  cancelWebhookDelivery,
  processDueWebhookDeliveries,
  queueWebhookDelivery,
  requeueFailedWebhookDelivery,
  scheduleWebhookQueue,
} from "@/lib/webhook/queue";

type ReviewMeetingScreenProps = {
  meetingId: string;
};

type PlayableAudio = {
  blob: Blob;
  mimeType: string;
  durationSec?: number;
};

export function ReviewMeetingScreen({ meetingId }: ReviewMeetingScreenProps) {
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [diarizationSupported, setDiarizationSupported] = useState(false);
  const [providerLabel, setProviderLabel] = useState("STT");
  const [notes, setNotes] = useState<Note[]>([]);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [detailMinutes, setDetailMinutes] =
    useState<MeetingDetailMinutes | null>(null);
  const [detailText, setDetailText] = useState<string | null>(null);
  const [aiOriginalSummary, setAiOriginalSummary] = useState<string | null>(
    null,
  );
  const [aiOriginalDetail, setAiOriginalDetail] =
    useState<MeetingDetailMinutes | null>(null);
  const [aiOriginalDetailText, setAiOriginalDetailText] = useState<
    string | null
  >(null);
  const [inputFingerprint, setInputFingerprint] = useState<string | null>(null);
  const [confirmedVersionNumber, setConfirmedVersionNumber] = useState<
    number | null
  >(null);
  const [generationSource, setGenerationSource] =
    useState<GenerationSource>("llm");
  const [versions, setVersions] = useState<GenerationVersion[]>([]);
  const [activeTab, setActiveTab] = useState<MeetingResultTab>("transcript");
  const [audio, setAudio] = useState<PlayableAudio | null>(null);
  const [seekToSec, setSeekToSec] = useState<number | null>(null);
  const [evidenceRef, setEvidenceRef] = useState<EvidenceRef | null>(null);
  const [viewingAiOriginal, setViewingAiOriginal] = useState(false);
  const [viewingVersion, setViewingVersion] =
    useState<GenerationVersion | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    "general" | "integrations"
  >("general");
  const [banner, setBanner] = useState<string | null>(null);
  const [webhookSettings, setWebhookSettings] = useState<{
    enabled: boolean;
    destinationAlias: string;
    includeFlags: WebhookIncludeFlags;
  }>({
    enabled: false,
    destinationAlias: DEFAULT_WEBHOOK_DESTINATION_ALIAS,
    includeFlags: DEFAULT_WEBHOOK_INCLUDE_FLAGS,
  });
  const [webhookDeliveries, setWebhookDeliveries] = useState<
    WebhookDelivery[]
  >([]);
  const [webhookBusyDeliveryId, setWebhookBusyDeliveryId] = useState<
    string | null
  >(null);
  const [webhookSendConfirmOpen, setWebhookSendConfirmOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const [
        m,
        transcript,
        generation,
        notesRows,
        playable,
        versionRows,
        deliveryRows,
        settings,
      ] = await Promise.all([
        getMeeting(meetingId),
        getMeetingTranscript(meetingId),
        getMeetingGeneration(meetingId),
        getNotesByMeeting(meetingId),
        loadPlayableMeetingAudio(meetingId),
        listGenerationVersions(meetingId),
        listWebhookDeliveries(meetingId),
        getAppSettings(),
      ]);

      if (!m) {
        setLoadError("회의를 찾을 수 없습니다.");
        setMeeting(null);
        return;
      }

      if (
        m.displayStatus === "준비" ||
        m.displayStatus === "녹음 중" ||
        m.displayStatus === "저장 중" ||
        m.displayStatus === "AI 처리 중"
      ) {
        router.replace(`/meetings/${meetingId}/record`);
        return;
      }

      setMeeting(m);
      setNotes(notesRows);
      setVersions(versionRows);
      setWebhookDeliveries(deliveryRows);
      setWebhookSettings({
        enabled: settings.webhookEnabled,
        destinationAlias: settings.webhookDestinationAlias,
        includeFlags: includeFlagsFromSettings(settings),
      });

      if (transcript) {
        setSegments(transcript.segments);
        setDiarizationSupported(Boolean(transcript.diarizationSupported));
        setProviderLabel(
          transcript.provider === "mock"
            ? "가상 데이터"
            : sttProviderLabel(
                transcript.provider === "assemblyai" ? "assemblyai" : "whisper",
              ),
        );
      } else {
        setSegments([]);
        setDiarizationSupported(false);
      }

      if (generation) {
        setSummaryText(generation.summaryText);
        setDetailMinutes(generation.detailMinutes);
        setDetailText(generation.detailText);
        setAiOriginalSummary(generation.aiOriginalSummaryText ?? null);
        setAiOriginalDetail(generation.aiOriginalDetailMinutes ?? null);
        setAiOriginalDetailText(generation.aiOriginalDetailText ?? null);
        setInputFingerprint(generation.inputFingerprint ?? null);
        setConfirmedVersionNumber(generation.confirmedVersionNumber ?? null);
        setGenerationSource(generation.source);
      } else {
        setSummaryText(null);
        setDetailMinutes(null);
        setDetailText(null);
        setAiOriginalSummary(null);
        setAiOriginalDetail(null);
        setAiOriginalDetailText(null);
        setInputFingerprint(null);
        setConfirmedVersionNumber(null);
      }

      if (playable?.audio) {
        setAudio({
          blob: playable.audio.blob,
          mimeType: playable.audio.mimeType,
          durationSec: playable.audio.durationSec || m.durationSec,
        });
      } else {
        setAudio(null);
      }
    } catch {
      setLoadError("회의 결과를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [meetingId, router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    function onSettingsChanged(event: Event) {
      const detail = (event as CustomEvent<AppSettings>).detail;
      if (!detail) return;
      setWebhookSettings({
        enabled: detail.webhookEnabled,
        destinationAlias: detail.webhookDestinationAlias,
        includeFlags: includeFlagsFromSettings(detail),
      });
    }
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () =>
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tickQueue() {
      await processDueWebhookDeliveries();
      if (cancelled) return;
      const rows = await listWebhookDeliveries(meetingId);
      if (!cancelled) setWebhookDeliveries(rows);
      const meetingRow = await getMeeting(meetingId);
      if (!cancelled && meetingRow) {
        setMeeting((prev) =>
          prev
            ? { ...prev, displayStatus: meetingRow.displayStatus }
            : prev,
        );
      }
      scheduleWebhookQueue();
    }
    void tickQueue();
    const interval = window.setInterval(() => void tickQueue(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [meetingId]);

  const currentFingerprint = useMemo(
    () =>
      buildGenerationInputFingerprint({
        segments,
        notes,
      }),
    [segments, notes],
  );

  const inputStale =
    Boolean(inputFingerprint) &&
    Boolean(summaryText || detailMinutes) &&
    inputFingerprint !== currentFingerprint;

  const hasAiResult = Boolean(summaryText || detailMinutes || detailText);
  const needsReviewCount = countNeedsReview(
    viewingVersion?.detailMinutes ?? detailMinutes,
  );

  const displaySummary = viewingVersion
    ? viewingVersion.summaryText
    : viewingAiOriginal
      ? aiOriginalSummary
      : summaryText;
  const displayDetail = viewingVersion
    ? viewingVersion.detailMinutes
    : viewingAiOriginal
      ? aiOriginalDetail
      : detailMinutes;
  const displayDetailText = viewingVersion
    ? viewingVersion.detailText
    : viewingAiOriginal
      ? aiOriginalDetailText
      : detailText;

  const resolvedEvidence = useMemo(
    () =>
      evidenceRef
        ? resolveEvidence({ ref: evidenceRef, segments, notes })
        : null,
    [evidenceRef, segments, notes],
  );

  async function handleSpeakerChange(segmentId: string, speakerLabel: string) {
    const next = segments.map((segment) =>
      segment.id === segmentId ? { ...segment, speakerLabel } : segment,
    );
    setSegments(next);
    await saveMeetingTranscript({
      meetingId,
      segments: next,
      provider: next[0]?.provider ?? "whisper",
      diarizationSupported,
      status: "completed",
    });
  }

  async function handleSaveDetail(next: MeetingDetailMinutes) {
    const text = formatDetailMinutesText(next);
    setDetailMinutes(next);
    setDetailText(text);
    await saveMeetingGeneration({
      meetingId,
      detailMinutes: next,
      detailText: text,
      source: generationSource,
    });
    const version = await createGenerationVersion({
      meetingId,
      kind: "user_edit",
      summaryText,
      detailText: text,
      detailMinutes: next,
      source: generationSource,
    });
    setVersions((prev) => [version, ...prev]);
    if (meeting?.confirmed) {
      await patchMeeting(meetingId, {
        confirmed: false,
        displayStatus: "검토 필요",
      });
      setMeeting((prev) =>
        prev
          ? { ...prev, confirmed: false, displayStatus: "검토 필요" }
          : prev,
      );
      setBanner("확정 이후 수정했습니다. 재확정 전까지 이전 확정본은 유지됩니다.");
    }
  }

  async function handleConfirm(options?: { queueSend?: boolean }) {
    if (!hasAiResult) return;
    setConfirmBusy(true);
    try {
      const version = await createGenerationVersion({
        meetingId,
        kind: "confirmed",
        summaryText,
        detailText,
        detailMinutes,
        source: generationSource,
      });
      await saveMeetingGeneration({
        meetingId,
        summaryText,
        detailText,
        detailMinutes,
        confirmedVersionNumber: version.versionNumber,
        source: generationSource,
      });
      await patchMeeting(meetingId, {
        confirmed: true,
        displayStatus: "확정됨",
        summaryPreview:
          summaryText?.split("\n").find((line) => line.trim()) ??
          meeting?.summaryPreview ??
          null,
      });
      setConfirmedVersionNumber(version.versionNumber);
      setVersions((prev) => [version, ...prev]);
      setMeeting((prev) =>
        prev
          ? { ...prev, confirmed: true, displayStatus: "확정됨" }
          : prev,
      );

      let sendNote = "";
      if (options?.queueSend && webhookSettings.enabled) {
        const eventId = createId("evt");
        const includeFlags = webhookSettings.includeFlags;
        const payloadSnapshot = buildWebhookPayload({
          eventId,
          meeting: {
            id: meetingId,
            title: meeting?.title ?? "회의록",
            startedAt: meeting?.startedAt ?? new Date().toISOString(),
            timezone: meeting?.timezone,
            attendees: meeting?.attendees,
            approvedVersion: version.versionNumber,
          },
          includeFlags,
          notes,
          summaryText,
          detailMinutes,
          detailText,
          segments,
        });
        const delivery = await queueWebhookDelivery({
          meetingId,
          approvedVersion: version.versionNumber,
          destinationAlias: webhookSettings.destinationAlias,
          includeFlags,
          payloadSnapshot,
          eventId,
        });
        setWebhookDeliveries((prev) => [delivery, ...prev]);
        setActiveTab("integrations");
        sendNote = `\n외부 전송 대기 중 · ${webhookSettings.destinationAlias}`;
        void processDueWebhookDeliveries().then(async () => {
          const rows = await listWebhookDeliveries(meetingId);
          setWebhookDeliveries(rows);
          const meetingRow = await getMeeting(meetingId);
          if (meetingRow) {
            setMeeting((prev) =>
              prev
                ? { ...prev, displayStatus: meetingRow.displayStatus }
                : prev,
            );
          }
        });
      }

      setBanner(
        `회의록이 확정되었습니다. 확정 버전 v${version.versionNumber} · ${formatMeetingDateTime(version.createdAt)}${sendNote}`,
      );
      setConfirmOpen(false);
    } catch (err) {
      setBanner(
        err instanceof Error ? err.message : "확정에 실패했습니다.",
      );
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleRestore(version: GenerationVersion) {
    const restored = await createGenerationVersion({
      meetingId,
      kind: "restored",
      summaryText: version.summaryText,
      detailText: version.detailText,
      detailMinutes: version.detailMinutes,
      source: version.source,
      restoredFromVersionNumber: version.versionNumber,
    });
    await saveMeetingGeneration({
      meetingId,
      summaryText: version.summaryText,
      detailText: version.detailText,
      detailMinutes: version.detailMinutes,
      source: version.source,
    });
    setSummaryText(version.summaryText);
    setDetailText(version.detailText);
    setDetailMinutes(version.detailMinutes);
    setGenerationSource(version.source);
    setVersions((prev) => [restored, ...prev]);
    setViewingVersion(null);
    setViewingAiOriginal(false);
    await patchMeeting(meetingId, {
      confirmed: false,
      displayStatus: "검토 필요",
      summaryPreview:
        version.summaryText?.split("\n").find((line) => line.trim()) ?? null,
    });
    setMeeting((prev) =>
      prev
        ? { ...prev, confirmed: false, displayStatus: "검토 필요" }
        : prev,
    );
    setBanner(
      `v${version.versionNumber}에서 복원했습니다. 새 초안(v${restored.versionNumber})이며 자동 확정·전송되지 않습니다.`,
    );
    setActiveTab("detail");
  }

  function exportMarkdown() {
    const title = meeting?.title ?? "회의록";
    const body = [
      `# ${title}`,
      "",
      "## 요약",
      displaySummary?.trim() || "(요약 없음)",
      "",
      "## 상세",
      displayDetail
        ? formatDetailMinutesText(displayDetail)
        : displayDetailText?.trim() || "(상세 없음)",
      "",
      "## 전사문",
      segments
        .map((segment) => {
          const time = `[${Math.floor(segment.startedAtSec / 60)}:${String(Math.floor(segment.startedAtSec % 60)).padStart(2, "0")}]`;
          const speaker = segment.speakerLabel
            ? `${segment.speakerLabel} `
            : "";
          return `${time} ${speaker}${segment.text}`;
        })
        .join("\n") || "(전사문 없음)",
    ].join("\n");

    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.slice(0, 40) || "meeting"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function enqueueConfirmedSend() {
    if (!meeting?.confirmed || confirmedVersionNumber == null) return;
    setWebhookBusyDeliveryId("new");
    try {
      const confirmedVersion = versions.find(
        (version) =>
          version.kind === "confirmed" &&
          version.versionNumber === confirmedVersionNumber,
      );
      const eventId = createId("evt");
      const includeFlags = webhookSettings.includeFlags;
      const payloadSnapshot = buildWebhookPayload({
        eventId,
        meeting: {
          id: meeting.id,
          title: meeting.title,
          startedAt: meeting.startedAt,
          timezone: meeting.timezone,
          attendees: meeting.attendees,
          approvedVersion: confirmedVersionNumber,
        },
        includeFlags,
        notes,
        summaryText: confirmedVersion?.summaryText ?? summaryText,
        detailMinutes: confirmedVersion?.detailMinutes ?? detailMinutes,
        detailText: confirmedVersion?.detailText ?? detailText,
        segments,
      });
      const delivery = await queueWebhookDelivery({
        meetingId,
        approvedVersion: confirmedVersionNumber,
        destinationAlias: webhookSettings.destinationAlias,
        includeFlags,
        payloadSnapshot,
        eventId,
      });
      setWebhookDeliveries((prev) => [delivery, ...prev]);
      setWebhookSendConfirmOpen(false);
      setBanner(
        `확정본 v${confirmedVersionNumber} 전송을 대기열에 등록했습니다.`,
      );
      await processDueWebhookDeliveries();
      const rows = await listWebhookDeliveries(meetingId);
      setWebhookDeliveries(rows);
      const meetingRow = await getMeeting(meetingId);
      if (meetingRow) {
        setMeeting((prev) =>
          prev ? { ...prev, displayStatus: meetingRow.displayStatus } : prev,
        );
      }
    } catch (err) {
      setBanner(
        err instanceof Error ? err.message : "전송 등록에 실패했습니다.",
      );
    } finally {
      setWebhookBusyDeliveryId(null);
    }
  }

  async function handleCancelDelivery(id: string) {
    setWebhookBusyDeliveryId(id);
    try {
      await cancelWebhookDelivery(id);
      const rows = await listWebhookDeliveries(meetingId);
      setWebhookDeliveries(rows);
      setBanner("대기 중인 전송을 취소했습니다.");
    } finally {
      setWebhookBusyDeliveryId(null);
    }
  }

  async function handleRetryDelivery(id: string) {
    setWebhookBusyDeliveryId(id);
    try {
      await requeueFailedWebhookDelivery(id);
      await processDueWebhookDeliveries();
      const rows = await listWebhookDeliveries(meetingId);
      setWebhookDeliveries(rows);
      const meetingRow = await getMeeting(meetingId);
      if (meetingRow) {
        setMeeting((prev) =>
          prev ? { ...prev, displayStatus: meetingRow.displayStatus } : prev,
        );
      }
      setBanner("동일 event_id로 재전송을 시작했습니다.");
    } finally {
      setWebhookBusyDeliveryId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-[var(--muted)]">회의 결과를 불러오는 중…</p>
      </div>
    );
  }

  if (loadError || !meeting) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-[var(--danger)]" role="alert">
          {loadError ?? "회의를 찾을 수 없습니다."}
        </p>
        <Link href="/meetings" className="btn btn-ghost mt-4 px-3 py-2 text-sm">
          ← 회의 목록
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/meetings"
              className="btn btn-ghost px-2.5 py-1.5 text-sm"
            >
              ← 회의 목록
            </Link>
            <StatusBadge status={meeting.displayStatus} />
          </div>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            {meeting.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {formatMeetingDateTime(meeting.startedAt)}
            {meeting.attendees ? ` · ${meeting.attendees}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/meetings/${meetingId}/record`}
            className="btn btn-ghost px-3 py-2 text-sm"
          >
            녹음 화면
          </Link>
          <button
            type="button"
            className="btn btn-ghost px-3 py-2 text-sm"
            onClick={exportMarkdown}
          >
            내보내기
          </button>
          <button
            type="button"
            className="btn btn-primary px-3 py-2 text-sm"
            disabled={!hasAiResult || Boolean(viewingVersion)}
            onClick={() => setConfirmOpen(true)}
          >
            {meeting.confirmed ? "재확정" : "확정"}
          </button>
        </div>
      </header>

      {banner && (
        <p
          className="rounded-xl bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]"
          role="status"
        >
          {banner}
        </p>
      )}

      {!hasAiResult && (
        <section className="glass-panel rounded-[var(--radius)] p-5 sm:p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
            AI 결과 없음
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            음성과 메모는 저장되어 있습니다. 검토 완료나 확정 상태가 아닙니다.
            녹음 화면에서 AI 회의록을 생성할 수 있습니다.
          </p>
          <Link
            href={`/meetings/${meetingId}/record`}
            className="btn btn-primary mt-4 inline-flex px-4 py-2 text-sm"
          >
            AI 회의록 생성
          </Link>
        </section>
      )}

      {inputStale && hasAiResult && !viewingVersion && (
        <section
          className="rounded-xl bg-[var(--warning-soft)] px-4 py-3 ring-1 ring-[var(--border)]"
          role="status"
        >
          <p className="text-sm font-semibold text-[var(--warning)]">
            원문이 변경되었습니다.
          </p>
          <p className="mt-1 text-sm text-[var(--foreground)]">
            현재 회의록은 변경 전 내용을 기준으로 생성되었습니다.
          </p>
          <Link
            href={`/meetings/${meetingId}/record`}
            className="btn btn-ghost mt-3 px-3 py-1.5 text-sm"
          >
            AI 회의록 다시 생성
          </Link>
        </section>
      )}

      {audio && (
        <div className="glass-panel rounded-[var(--radius)] p-5 sm:p-6">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            원본 음성
          </h2>
          <AudioPlayer
            blob={audio.blob}
            mimeType={audio.mimeType}
            fileName={meeting.title.slice(0, 40) || "meeting"}
            seekToSec={seekToSec}
            onSeekHandled={() => setSeekToSec(null)}
          />
        </div>
      )}

      {resolvedEvidence && (
        <EvidencePanel
          evidence={resolvedEvidence}
          audioBlob={audio?.blob ?? null}
          audioMimeType={audio?.mimeType ?? "audio/webm"}
          audioDurationSec={audio?.durationSec ?? meeting.durationSec}
          fileName={meeting.title.slice(0, 40) || "meeting"}
          onClose={() => setEvidenceRef(null)}
          onViewInTranscript={() => {
            setActiveTab("transcript");
            if (resolvedEvidence.startTimeSec != null) {
              setSeekToSec(resolvedEvidence.startTimeSec);
            }
          }}
        />
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <MeetingResultTabs
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              if (tab !== "history") setViewingVersion(null);
            }}
            segments={segments}
            providerLabel={providerLabel}
            diarizationSupported={diarizationSupported}
            summaryText={displaySummary}
            detailMinutes={displayDetail}
            detailText={displayDetailText}
            summarySourceLabel={
              viewingVersion
                ? `v${viewingVersion.versionNumber}`
                : viewingAiOriginal
                  ? "AI 생성본"
                  : generationSource === "mock"
                    ? "가상 데이터"
                    : undefined
            }
            detailSourceLabel={
              viewingVersion
                ? `v${viewingVersion.versionNumber}`
                : viewingAiOriginal
                  ? "AI 생성본"
                  : undefined
            }
            onSaveDetail={
              viewingVersion || viewingAiOriginal ? undefined : handleSaveDetail
            }
            onSpeakerChange={
              viewingVersion ? undefined : handleSpeakerChange
            }
            onSeekSegment={(sec) => setSeekToSec(sec)}
            onOpenEvidence={(ref) => setEvidenceRef(ref)}
            showAiOriginalToggle={Boolean(
              aiOriginalDetail &&
                detailMinutes &&
                JSON.stringify(aiOriginalDetail) !==
                  JSON.stringify(detailMinutes),
            )}
            viewingAiOriginal={viewingAiOriginal}
            onToggleAiOriginal={() =>
              setViewingAiOriginal((prev) => !prev)
            }
            versions={versions}
            viewingVersionId={viewingVersion?.id ?? null}
            onViewVersion={(version) => {
              setViewingVersion(version);
              setViewingAiOriginal(false);
              setActiveTab("detail");
            }}
            onRestoreVersion={(version) => void handleRestore(version)}
            onViewCurrentDraft={() => setViewingVersion(null)}
            confirmed={meeting.confirmed}
            confirmedVersionNumber={confirmedVersionNumber}
            webhookEnabled={webhookSettings.enabled}
            webhookDestinationAlias={webhookSettings.destinationAlias}
            webhookIncludeFlags={webhookSettings.includeFlags}
            webhookDeliveries={webhookDeliveries}
            webhookBusyDeliveryId={webhookBusyDeliveryId}
            webhookSendConfirmOpen={webhookSendConfirmOpen}
            onRequestSendWebhook={() => setWebhookSendConfirmOpen(true)}
            onCancelSendWebhookConfirm={() => setWebhookSendConfirmOpen(false)}
            onConfirmSendWebhook={() => void enqueueConfirmedSend()}
            onCancelWebhookDelivery={(id) => void handleCancelDelivery(id)}
            onRetryWebhookDelivery={(id) => void handleRetryDelivery(id)}
            onOpenSettings={() => {
              setSettingsInitialTab("integrations");
              setSettingsOpen(true);
            }}
          />

          <div className="glass-panel rounded-[var(--radius)] p-5 sm:p-6">
            <NoteSection
              meetingId={meetingId}
              recordingElapsedSec={null}
              onSeekTimestamp={setSeekToSec}
            />
          </div>
        </div>

        <aside className="h-fit lg:sticky lg:top-24">
          <div className="glass-panel rounded-[var(--radius)] p-5">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              회의 정보
            </h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs text-[var(--muted)]">상태</dt>
                <dd className="mt-1">
                  <StatusBadge status={meeting.displayStatus} />
                </dd>
              </div>
              {confirmedVersionNumber != null && (
                <div>
                  <dt className="text-xs text-[var(--muted)]">확정 버전</dt>
                  <dd className="mt-1 font-medium">v{confirmedVersionNumber}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-[var(--muted)]">확인 필요</dt>
                <dd className="mt-1 font-medium">
                  {needsReviewCount > 0 ? `${needsReviewCount}개` : "없음"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">태그</dt>
                <dd className="mt-1">
                  {meeting.tags.length > 0 ? meeting.tags.join(", ") : "없음"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="회의록을 확정하시겠습니까?"
        description={
          [
            needsReviewCount > 0
              ? `확정 후에도 수정할 수 있지만, 수정 시 새로운 버전이 생성됩니다.\n\n현재 확인 필요 항목: ${needsReviewCount}개\n확인 필요 문구는 자동으로 삭제되지 않습니다.`
              : "확정 후에도 수정할 수 있지만, 수정 시 새로운 버전이 생성됩니다.",
            webhookSettings.enabled
              ? `\n\n외부 연동이 설정되어 있습니다.\n수신처\n${webhookSettings.destinationAlias}`
              : "",
          ].join("")
        }
        confirmLabel={
          confirmBusy
            ? "확정 중…"
            : webhookSettings.enabled
              ? "확정 및 전송"
              : "확정"
        }
        secondaryLabel={
          webhookSettings.enabled && !confirmBusy ? "확정만" : undefined
        }
        onCancel={() => setConfirmOpen(false)}
        onSecondary={() => {
          if (!confirmBusy) void handleConfirm({ queueSend: false });
        }}
        onConfirm={() => {
          if (!confirmBusy) {
            void handleConfirm({
              queueSend: webhookSettings.enabled,
            });
          }
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        initialTab={settingsInitialTab}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsInitialTab("general");
        }}
      />
    </div>
  );
}
