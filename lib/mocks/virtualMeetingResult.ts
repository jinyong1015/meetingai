import type { MeetingDetailMinutes } from "@/lib/types/detail";
import { formatDetailMinutesText } from "@/lib/types/detail";
import type { TranscriptSegment } from "@/lib/types/transcript";

/**
 * Virtual STT + summary + detail preview data.
 * Detail content mirrors the attached sample minutes document.
 */
export const VIRTUAL_TRANSCRIPT_SEGMENTS: TranscriptSegment[] = [
  {
    id: "virtual-seg-1",
    text: "김팀장: 오늘은 2024년 마케팅 전략회의를 시작하겠습니다. 회의 목적은 3분기 마케팅 전략 수립입니다. 참석자는 김팀장, 이대리, 박사원, 최사원입니다.",
    startedAtSec: 0,
  },
  {
    id: "virtual-seg-2",
    text: "이대리: 안건 1, 2분기 마케팅 성과 리뷰입니다. 온라인 광고 캠페인 성과 분석 결과를 발표하겠습니다. 전반적으로 전환율이 개선되었고, 예산 대비 효율도 양호했습니다.",
    startedAtSec: 48,
  },
  {
    id: "virtual-seg-3",
    text: "박사원: 소셜 미디어 인게이지먼트 통계를 공유합니다. 반응은 늘어났지만 전환으로 이어지는 전략은 재검토가 필요합니다.",
    startedAtSec: 112,
  },
  {
    id: "virtual-seg-4",
    text: "김팀장: 온라인 광고 예산 10% 증액을 결정하겠습니다. 박사원은 소셜 미디어 전략을 2024년 6월 30일까지 재검토해 주세요.",
    startedAtSec: 168,
  },
  {
    id: "virtual-seg-5",
    text: "최사원: 안건 2, 3분기 마케팅 전략입니다. 새로운 타겟 시장 조사 결과를 발표합니다. 신규 세그먼트에서 수요가 확인되었습니다.",
    startedAtSec: 220,
  },
  {
    id: "virtual-seg-6",
    text: "김팀장: 경쟁사 분석 보고입니다. 신규 타겟 시장을 겨냥한 캠페인 실행을 결정합니다. 이대리는 2024년 7월 10일까지 신규 캠페인 기획안을 작성해 주세요.",
    startedAtSec: 278,
  },
  {
    id: "virtual-seg-7",
    text: "김팀장: 다음 회의는 2024년 7월 15일 오전 10시입니다. 추가 논의 사항으로 마케팅 예산 재분배를 남겨 두겠습니다. 이상 회의를 마치겠습니다.",
    startedAtSec: 340,
  },
];

export const VIRTUAL_SUMMARY_TEXT = `2024년 마케팅 전략회의에서 3분기 마케팅 전략 수립을 논의했다.

2분기 성과 리뷰 결과 온라인 광고 예산을 10% 증액하기로 했고, 박사원이 6월 30일까지 소셜 미디어 전략을 재검토한다. 3분기에는 신규 타겟 시장 캠페인 실행을 결정했으며, 이대리가 7월 10일까지 신규 캠페인 기획안을 작성한다.

다음 회의는 2024년 7월 15일 오전 10시이며, 마케팅 예산 재분배는 추가 논의 사항으로 남겼다.`;

/** Detailed minutes matching the attached sample document. */
export const VIRTUAL_DETAIL_MINUTES: MeetingDetailMinutes = {
  documentTitle: "2024년 마케팅 전략회의",
  meetingTitle: "마케팅 전략 회의",
  datetime: "2024년 6월 19일, 오전 10시",
  location: "본사 회의실 3",
  attendees: ["김팀장", "이대리", "박사원", "최사원"],
  host: "김팀장",
  purpose: "3분기 마케팅 전략 수립",
  agendas: [
    {
      title: "2분기 마케팅 성과 리뷰",
      discussions: [
        {
          speaker: null,
          content: "온라인 광고 캠페인 성과 분석 결과 발표",
        },
        {
          speaker: null,
          content: "소셜 미디어 인게이지먼트 통계 공유",
        },
      ],
      decisions: ["온라인 광고 예산 10% 증액 결정"],
      actionItems: [
        {
          owner: null,
          task: "소셜 미디어 전략 재검토",
          due: "2024년 6월 30일",
        },
      ],
    },
    {
      title: "3분기 마케팅 전략 수립",
      discussions: [
        {
          speaker: null,
          content: "새로운 타겟 시장 조사 결과 발표",
        },
        {
          speaker: null,
          content: "경쟁사 분석 보고",
        },
      ],
      decisions: ["신규 타겟 시장을 겨냥한 캠페인 실행 결정"],
      actionItems: [
        {
          owner: null,
          task: "신규 캠페인 기획안 작성",
          due: "2024년 7월 10일",
        },
      ],
    },
  ],
  nextMeeting: "2024년 7월 15일, 오전 10시",
  additionalItems: ["마케팅 예산 재분배"],
};

export const VIRTUAL_DETAIL_TEXT = formatDetailMinutesText(
  VIRTUAL_DETAIL_MINUTES,
);

export function getVirtualTranscriptFullText(): string {
  return VIRTUAL_TRANSCRIPT_SEGMENTS.map((segment) => segment.text).join("\n");
}
