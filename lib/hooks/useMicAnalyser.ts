"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

const BAR_COUNT = 24;
const IDLE_LEVELS = Array.from({ length: BAR_COUNT }, () => 0.08);

export type MicAnalyserError =
  | "unsupported"
  | "insecure"
  | "permission-denied"
  | "not-found"
  | "unknown";

export type MicPermissionPhase =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "error";

type UseMicAnalyserOptions = {
  /** When true, analyser samples mic levels. When false, levels stay flat. */
  active: boolean;
};

type UseMicAnalyserResult = {
  levels: number[];
  error: MicAnalyserError | null;
  phase: MicPermissionPhase;
  /** Live microphone stream (null when stopped). */
  stream: MediaStream | null;
  /** Opens mic + analyser. Resolves true on success. */
  start: () => Promise<boolean>;
  /** Releases mic and audio context. */
  stop: () => void;
  /** Mutes tracks without releasing the stream. */
  setMuted: (muted: boolean) => void;
};

function mapMediaError(err: unknown): MicAnalyserError {
  const name =
    err instanceof DOMException
      ? err.name
      : err && typeof err === "object" && "name" in err
        ? String((err as { name: unknown }).name)
        : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "permission-denied";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "not-found";
  }
  if (name === "NotSupportedError" || name === "TypeError") {
    return "unsupported";
  }
  if (name === "SecurityError") return "insecure";
  return "unknown";
}

export function useMicAnalyser({
  active,
}: UseMicAnalyserOptions): UseMicAnalyserResult {
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);
  const [error, setError] = useState<MicAnalyserError | null>(null);
  const [phase, setPhase] = useState<MicPermissionPhase>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothedRef = useRef<number[]>([...IDLE_LEVELS]);
  const lastPaintRef = useRef(0);
  const startGenerationRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const releaseHardware = useCallback(() => {
    stopLoop();
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    if (contextRef.current) {
      void contextRef.current.close();
      contextRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    smoothedRef.current = [...IDLE_LEVELS];
  }, [stopLoop]);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    const next = new Array<number>(BAR_COUNT);
    const usable = Math.max(1, Math.floor(data.length * 0.55));
    const chunk = Math.max(1, Math.floor(usable / BAR_COUNT));

    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0;
      const start = i * chunk;
      for (let j = 0; j < chunk; j++) {
        sum += data[start + j] ?? 0;
      }
      const raw = Math.min(1, sum / (chunk * 255) * 1.55);
      const prev = smoothedRef.current[i] ?? 0.08;
      next[i] = raw > prev ? prev * 0.35 + raw * 0.65 : prev * 0.82 + raw * 0.18;
      next[i] = Math.max(0.06, Math.min(1, next[i]));
    }

    smoothedRef.current = next;
    const now = performance.now();
    if (now - lastPaintRef.current >= 50) {
      lastPaintRef.current = now;
      setLevels(next);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    if (typeof window === "undefined") return false;

    if (!window.isSecureContext) {
      setError("insecure");
      setPhase("error");
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      setPhase("error");
      return false;
    }

    const generation = ++startGenerationRef.current;
    releaseHardware();

    // Paint the in-app prompt first, then request mic in the same click turn.
    flushSync(() => {
      setLevels(IDLE_LEVELS);
      setError(null);
      setPhase("requesting");
    });

    try {
      // Keep constraints simple so the browser permission prompt is more reliable.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (generation !== startGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) {
        stream.getTracks().forEach((track) => track.stop());
        setError("unsupported");
        setPhase("error");
        return false;
      }

      const context = new AudioContextCtor();
      if (context.state === "suspended") {
        await context.resume();
      }

      if (generation !== startGenerationRef.current) {
        void context.close();
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.55;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      streamRef.current = stream;
      setStream(stream);
      contextRef.current = context;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setError(null);
      setPhase("granted");
      stopLoop();
      rafRef.current = requestAnimationFrame(tick);
      return true;
    } catch (err) {
      if (generation !== startGenerationRef.current) return false;
      releaseHardware();
      setLevels(IDLE_LEVELS);
      const mapped = mapMediaError(err);
      setError(mapped);
      setPhase(mapped === "permission-denied" ? "denied" : "error");
      return false;
    }
  }, [releaseHardware, stopLoop, tick]);

  const stop = useCallback(() => {
    startGenerationRef.current += 1;
    releaseHardware();
    setLevels(IDLE_LEVELS);
    setError(null);
    setPhase("idle");
  }, [releaseHardware]);

  const setMuted = useCallback(
    (muted: boolean) => {
      streamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      if (muted) {
        stopLoop();
        smoothedRef.current = [...IDLE_LEVELS];
        setLevels(IDLE_LEVELS);
      } else if (analyserRef.current && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [stopLoop, tick],
  );

  useEffect(() => {
    if (!active) {
      stopLoop();
      setLevels(IDLE_LEVELS);
      return;
    }
    if (analyserRef.current && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [active, stopLoop, tick]);

  const releaseHardwareRef = useRef(releaseHardware);
  releaseHardwareRef.current = releaseHardware;

  useEffect(() => {
    return () => {
      startGenerationRef.current += 1;
      releaseHardwareRef.current();
    };
  }, []);

  return { levels, error, phase, stream, start, stop, setMuted };
}
