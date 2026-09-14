"use client";

import { useCallback, useEffect, useRef } from "react";

const CHUNK_TIMESLICE_MS = 5000;

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

export type RecorderChunkEvent = {
  blob: Blob;
  mimeType: string;
  sequence: number;
};

type StartOptions = {
  /** Called for each timeslice / final dataavailable chunk (REC-04). */
  onChunk?: (event: RecorderChunkEvent) => void;
};

type UseMeetingRecorderResult = {
  /** Begin capturing from the live mic stream. */
  start: (stream: MediaStream, options?: StartOptions) => boolean;
  pause: () => void;
  resume: () => void;
  /** Stop and return the assembled recorded audio blob. */
  stop: () => Promise<RecordedAudio | null>;
  reset: () => void;
};

/**
 * MediaRecorder wrapper for meeting audio.
 * Pause time is excluded from the file when pause()/resume() are used.
 * Requests data about every 5s for local chunk persistence (REC-04).
 */
export function useMeetingRecorder(): UseMeetingRecorderResult {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("audio/webm");
  const sequenceRef = useRef(0);
  const onChunkRef = useRef<StartOptions["onChunk"]>(undefined);

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
    sequenceRef.current = 0;
    onChunkRef.current = undefined;
  }, []);

  useEffect(() => () => reset(), [reset]);

  const start = useCallback(
    (stream: MediaStream, options?: StartOptions) => {
      if (typeof MediaRecorder === "undefined") return false;
      reset();

      const mimeType = pickMimeType();
      onChunkRef.current = options?.onChunk;
      try {
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        mimeTypeRef.current = recorder.mimeType || mimeType || "audio/webm";
        chunksRef.current = [];
        sequenceRef.current = 0;
        recorder.ondataavailable = (event) => {
          if (event.data.size === 0) return;
          chunksRef.current.push(event.data);
          const sequence = sequenceRef.current;
          sequenceRef.current += 1;
          onChunkRef.current?.({
            blob: event.data,
            mimeType: mimeTypeRef.current,
            sequence,
          });
        };
        recorder.start(CHUNK_TIMESLICE_MS);
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
        onChunkRef.current = undefined;
        resolve(
          blob.size > 0 ? { blob, mimeType: mimeTypeRef.current } : null,
        );
      };
      try {
        if (recorder.state !== "inactive") {
          // Flush the final partial timeslice before stop.
          try {
            recorder.requestData();
          } catch {
            // ignore
          }
          recorder.stop();
        } else {
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
