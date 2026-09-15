/** Fixed sample used only for SET-05 trial generation — never real meeting data. */
export const SAMPLE_TRIAL_TRANSCRIPT = `화자 A: 오늘은 샘플 킥오프 회의입니다. 목표는 이번 분기 일정 확정입니다.
화자 B: 개발 일정은 다음 주 월요일까지 초안을 공유하겠습니다.
화자 A: 그러면 일정 초안 공유를 결정하고, 담당은 이대리, 기한은 다음 주 월요일로 둡니다.
화자 C: 디자인 리뷰는 아직 미정이니 확인이 필요합니다.`;

export const SAMPLE_TRIAL_MEETING = {
  title: "샘플 킥오프 회의",
  startedAt: "2026-09-15T10:00:00+09:00",
  attendees: "김팀장, 이대리, 박사원",
  tags: ["샘플", "시험생성"],
};

export const SAMPLE_TRIAL_NOTES = [
  {
    content: "일정 초안은 다음 주 월요일까지",
    timestampSec: 45,
    important: true,
  },
];
