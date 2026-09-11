"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

const BAR_COUNT = 24;
const IDLE_LEVEL = 0.06;
const IDLE_LEVELS = Array.from({ length: BAR_COUNT }, () => IDLE_LEVEL);

/** Absolute RMS below this is always treated as silence. */
const ABSOLUTE_SILENCE = 0.012;
/** Speak when RMS exceeds noise floor by this factor. */
const VOICE_RATIO = 2.4;
/** Minimum gap above noise floor to count as voice. */
const VOICE_MARGIN = 0.01;

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
  /** True while speech-like energy is above the adaptive gate. */
  voiceActive: boolean;
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

function computeRms(timeData: Uint8Array): number {
  let sumSq = 0;
  for (let i = 0; i < timeData.length; i++) {
    const centered = ((timeData[i] ?? 128) - 128) / 128;
    sumSq += centered * centered;
  }
  return Math.sqrt(sumSq / Math.max(1, timeData.length));
}

export function useMicAnalyser({
  active,
}: UseMicAnalyserOptions): UseMicAnalyserResult {
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);
  const [voiceActive, setVoiceActive] = useState(false);
  const [error, setError] = useState<MicAnalyserError | null>(null);
  const [phase, setPhase] = useState<MicPermissionPhase>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothedRef = useRef<number[]>([...IDLE_LEVELS]);
  const noiseFloorRef = useRef(0.02);
  const voiceActiveRef = useRef(false);
  const lastPaintRef = useRef(0);
  const startGenerationRef = useRef(0);
  const timeBufferRef = useRef<Uint8Array | null>(null);
  const freqBufferRef = useRef<Uint8Array | null>(null);

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
    noiseFloorRef.current = 0.02;
    voiceActiveRef.current = false;
    timeBufferRef.current = null;
    freqBufferRef.current = null;
  }, [stopLoop]);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    if (
      !timeBufferRef.current ||
      timeBufferRef.current.length !== analyser.fftSize
    ) {
      timeBufferRef.current = new Uint8Array(analyser.fftSize);
    }
    if (
      !freqBufferRef.current ||
      freqBufferRef.current.length !== analyser.frequencyBinCount
    ) {
      freqBufferRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    const timeData = timeBufferRef.current;
    const freqData = freqBufferRef.current;
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    const rms = computeRms(timeData);
    const floor = noiseFloorRef.current;
    const gate = Math.max(
      ABSOLUTE_SILENCE,
      floor * VOICE_RATIO + VOICE_MARGIN,
    );
    const speaking = rms >= gate;

    // Adapt noise floor only while quiet so speech does not raise the gate.
    if (!speaking) {
      noiseFloorRef.current = floor * 0.96 + rms * 0.04;
    } else {
      noiseFloorRef.current = floor * 0.999 + Math.min(rms, floor) * 0.001;
    }

    const next = new Array<number>(BAR_COUNT);

    if (!speaking) {
      for (let i = 0; i < BAR_COUNT; i++) {
        const prev = smoothedRef.current[i] ?? IDLE_LEVEL;
        next[i] = prev * 0.72;
        if (next[i] < IDLE_LEVEL + 0.02) next[i] = IDLE_LEVEL;
      }
    } else {
      // Prefer speech-band bins (~85Hz–4kHz); skip DC / very low rumble.
      const binCount = freqData.length;
      const speechStart = Math.min(2, binCount - 1);
      const speechEnd = Math.max(
        speechStart + 1,
        Math.floor(binCount * 0.45),
      );
      const speechBins = speechEnd - speechStart;
      const chunk = Math.max(1, Math.floor(speechBins / BAR_COUNT));
      const energyBoost = Math.min(1.8, 0.55 + rms * 8);

      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        const start = speechStart + i * chunk;
        for (let j = 0; j < chunk; j++) {
          sum += freqData[start + j] ?? 0;
        }
        const raw = Math.min(1, (sum / (chunk * 255)) * energyBoost);
        const prev = smoothedRef.current[i] ?? IDLE_LEVEL;
        next[i] =
          raw > prev ? prev * 0.3 + raw * 0.7 : prev * 0.78 + raw * 0.22;
        next[i] = Math.max(IDLE_LEVEL, Math.min(1, next[i]));
      }
    }

    smoothedRef.current = next;
    voiceActiveRef.current = speaking;

    const now = performance.now();
    if (now - lastPaintRef.current >= 50) {
      lastPaintRef.current = now;
      setLevels(next);
      setVoiceActive(speaking);
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
      setVoiceActive(false);
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
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.35;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -25;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      streamRef.current = stream;
      setStream(stream);
      contextRef.current = context;
      analyserRef.current = analyser;
      sourceRef.current = source;
      noiseFloorRef.current = 0.02;
      setError(null);
      setPhase("granted");
      stopLoop();
      rafRef.current = requestAnimationFrame(tick);
      return true;
    } catch (err) {
      if (generation !== startGenerationRef.current) return false;
      releaseHardware();
      setLevels(IDLE_LEVELS);
      setVoiceActive(false);
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
    setVoiceActive(false);
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
        voiceActiveRef.current = false;
        setLevels(IDLE_LEVELS);
        setVoiceActive(false);
      } else if (analyserRef.current && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [stopLoop, tick],
  );

  useEffect(() => {
    if (!active) {
      stopLoop();
      smoothedRef.current = [...IDLE_LEVELS];
      voiceActiveRef.current = false;
      setLevels(IDLE_LEVELS);
      setVoiceActive(false);
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

  return {
    levels,
    voiceActive,
    error,
    phase,
    stream,
    start,
    stop,
    setMuted,
  };
}
