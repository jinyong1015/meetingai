export type SttProvider = "assemblyai" | "whisper";

export type SttTranscribeInput = {
  audio: Buffer;
  mimeType: string;
  language?: string;
};

export type SttTranscribeResult = {
  text: string;
  provider: SttProvider;
  model: string;
  language: string;
};

export interface SttAdapter {
  readonly provider: SttProvider;
  transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult>;
}
