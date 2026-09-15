"use client";

import { use } from "react";
import { ReviewMeetingScreen } from "@/components/review/ReviewMeetingScreen";

export default function MeetingReviewPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = use(params);
  return <ReviewMeetingScreen meetingId={meetingId} />;
}
