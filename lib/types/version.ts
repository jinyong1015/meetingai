import type { MeetingDetailMinutes } from "@/lib/types/detail";
import type { GenerationSource } from "@/lib/types/generation";

export type GenerationVersionKind =
  | "ai_initial"
  | "ai_regenerated"
  | "user_edit"
  | "confirmed"
  | "restored";

/** Immutable preserved snapshot of summary/detail for one meeting. */
export type GenerationVersion = {
  id: string;
  meetingId: string;
  versionNumber: number;
  kind: GenerationVersionKind;
  label: string;
  summaryText: string | null;
  detailText: string | null;
  detailMinutes: MeetingDetailMinutes | null;
  source: GenerationSource;
  createdAt: string;
  restoredFromVersionNumber?: number;
};

export function versionKindLabel(kind: GenerationVersionKind): string {
  switch (kind) {
    case "ai_initial":
      return "AI 최초 생성";
    case "ai_regenerated":
      return "AI 재생성";
    case "user_edit":
      return "사용자 수정";
    case "confirmed":
      return "확정본";
    case "restored":
      return "이전 버전 복원";
    default:
      return kind;
  }
}
