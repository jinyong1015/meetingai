export type SttProvider = "assemblyai" | "whisper";

export type SttTranscribeInput = {
  /** Raw audio bytes (Node Buffer or browser ArrayBuffer/Uint8Array). */
  audio: ArrayBuffer | Uint8Array;
  mimeType: string;
  language?: string;
};

export type SttSegmentResult = {
  id: string;
  text: string;
  startedAtSec: number;
  endedAtSec?: number;
  speakerLabel?: string | null;
  originalSpeakerLabel?: string | null;
};

export type SttTranscribeResult = {
  text: string;
  provider: SttProvider;
  model: string;
  language: string;
  segments: SttSegmentResult[];
  /** True when multiple speakers were distinguished. */
  diarizationSupported: boolean;
  /** Remote async job id when the engine supports re-query (AI-05). */
  remoteJobId?: string | null;
};

export type SttJobStatus = "queued" | "processing" | "completed" | "error";

export type SttJobResult = SttTranscribeResult & {
  status: SttJobStatus;
  error?: string;
};

export interface SttAdapter {
  readonly provider: SttProvider;
  transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult>;
  /** Start async job without waiting for completion (AssemblyAI). */
  startJob?(
    input: SttTranscribeInput,
  ): Promise<{ remoteJobId: string; provider: SttProvider; model: string }>;
  /** AI-05: re-query an existing remote transcription job when supported. */
  getJob?(jobId: string): Promise<SttJobResult>;
}
