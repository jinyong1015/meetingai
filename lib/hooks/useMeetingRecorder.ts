"use client";

import { useCallback, useEffect, useRef } from "react";

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export type RecordedAudio = {
  blob: Blob;
  mimeType: string;
};

type UseMeetingRecorderResult = {
  /** Begin capturing from the live mic stream. */
  start: (stream: MediaStream) => boolean;
  pause: () => void;
  resume: () => void;
  /** Stop and return the recorded audio blob. */
  stop: () => Promise<RecordedAudio | null>;
  reset: () => void;
};

/**
 * MediaRecorder wrapper for meeting audio.
 * Pause time is excluded from the file when pause()/resume() are used.
 */
export function useMeetingRecorder(): UseMeetingRecorderResult {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("audio/webm");

  const reset = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => reset(), [reset]);

  const start = useCallback(
    (stream: MediaStream) => {
      if (typeof MediaRecorder === "undefined") return false;
      reset();

      const mimeType = pickMimeType();
      try {
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        mimeTypeRef.current = recorder.mimeType || mimeType || "audio/webm";
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.start(1000);
        recorderRef.current = recorder;
        return true;
      } catch {
        recorderRef.current = null;
        return false;
      }
    },
    [reset],
  );

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.pause();
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "paused") recorder.resume();
  }, []);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      if (chunksRef.current.length === 0) return null;
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
      chunksRef.current = [];
      return blob.size > 0
        ? { blob, mimeType: mimeTypeRef.current }
        : null;
    }

    return new Promise<RecordedAudio | null>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current,
        });
        chunksRef.current = [];
        recorderRef.current = null;
        resolve(
          blob.size > 0 ? { blob, mimeType: mimeTypeRef.current } : null,
        );
      };
      try {
        if (recorder.state !== "inactive") recorder.stop();
        else {
          recorderRef.current = null;
          resolve(null);
        }
      } catch {
        recorderRef.current = null;
        resolve(null);
      }
    });
  }, []);

  return { start, pause, resume, stop, reset };
}
