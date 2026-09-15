"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatTimestamp } from "@/lib/utils/format-time";

type AudioPlayerProps = {
  blob: Blob;
  mimeType: string;
  fileName?: string;
  /** Seek target in seconds (from memo timestamps). */
  seekToSec?: number | null;
  onSeekHandled?: () => void;
  /** Optional stop point for evidence clip playback. */
  stopAtSec?: number | null;
  onStoppedAtClipEnd?: () => void;
  className?: string;
};

export function AudioPlayer({
  blob,
  mimeType,
  fileName = "meeting-audio",
  seekToSec = null,
  onSeekHandled,
  stopAtSec = null,
  onStoppedAtClipEnd,
  className = "",
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const sliderId = useId();

  useEffect(() => {
    stopAtRef.current = stopAtSec;
  }, [stopAtSec]);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    setPlaying(false);
    setCurrentSec(0);
    setDurationSec(0);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useEffect(() => {
    if (seekToSec == null || !audioRef.current) return;
    const audio = audioRef.current;
    const target = Math.max(0, seekToSec);
    const apply = () => {
      audio.currentTime = Math.min(target, audio.duration || target);
      setCurrentSec(audio.currentTime);
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
      onSeekHandled?.();
    };
    if (audio.readyState >= 1) apply();
    else {
      const onLoaded = () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        apply();
      };
      audio.addEventListener("loadedmetadata", onLoaded);
      return () => audio.removeEventListener("loadedmetadata", onLoaded);
    }
  }, [seekToSec, onSeekHandled]);

  function extensionForMime(type: string): string {
    if (type.includes("mp4")) return "mp4";
    if (type.includes("ogg")) return "ogg";
    return "webm";
  }

  function handleDownload() {
    if (!objectUrl) return;
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${fileName}.${extensionForMime(mimeType)}`;
    link.click();
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
      setError(null);
    } catch {
      setError("브라우저에서 재생을 시작하지 못했습니다. 재생 버튼을 다시 눌러 주세요.");
      setPlaying(false);
    }
  }

  function clearClipStop() {
    stopAtRef.current = null;
  }

  async function continuePlay() {
    clearClipStop();
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setPlaying(true);
      setError(null);
    } catch {
      setError("브라우저에서 재생을 시작하지 못했습니다. 재생 버튼을 다시 눌러 주세요.");
      setPlaying(false);
    }
  }

  return (
    <div
      className={`rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-[var(--border)] ${className}`}
    >
      {objectUrl && (
        <audio
          ref={audioRef}
          src={objectUrl}
          preload="metadata"
          onTimeUpdate={() => {
            const audio = audioRef.current;
            if (!audio) return;
            setCurrentSec(audio.currentTime);
            const stop = stopAtRef.current;
            if (stop != null && audio.currentTime >= stop) {
              audio.pause();
              setPlaying(false);
              stopAtRef.current = null;
              onStoppedAtClipEnd?.();
            }
          }}
          onLoadedMetadata={() => {
            const audio = audioRef.current;
            if (!audio) return;
            setDurationSec(Number.isFinite(audio.duration) ? audio.duration : 0);
          }}
          onEnded={() => setPlaying(false)}
          onError={() => {
            setError("음성 파일을 재생할 수 없습니다. 다운로드 후 외부 플레이어로 확인해 주세요.");
            setPlaying(false);
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-accent px-3 py-2 text-sm"
          onClick={() => void togglePlay()}
          disabled={!objectUrl}
        >
          {playing ? "일시정지" : "재생"}
        </button>
        {stopAtSec != null && !playing && (
          <button
            type="button"
            className="btn btn-ghost px-3 py-2 text-sm"
            onClick={() => void continuePlay()}
            disabled={!objectUrl}
          >
            계속 재생
          </button>
        )}
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-[var(--muted)]">
          <span className="font-[family-name:var(--font-mono)] tabular-nums">
            {formatTimestamp(currentSec)}
          </span>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={Math.max(durationSec, 0.1)}
            step={0.1}
            value={Math.min(currentSec, durationSec || currentSec)}
            aria-label="재생 위치"
            className="min-w-0 flex-1 accent-[var(--accent)]"
            onChange={(event) => {
              const next = Number(event.target.value);
              const audio = audioRef.current;
              if (audio) audio.currentTime = next;
              setCurrentSec(next);
            }}
          />
          <span className="font-[family-name:var(--font-mono)] tabular-nums">
            {formatTimestamp(durationSec)}
          </span>
        </label>
        <button
          type="button"
          className="btn btn-ghost px-3 py-2 text-sm"
          onClick={handleDownload}
          disabled={!objectUrl}
        >
          다운로드
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
