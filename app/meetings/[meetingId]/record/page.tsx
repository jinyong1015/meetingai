"use client";

import { use } from "react";
import { RecordMeetingScreen } from "@/components/recording/RecordMeetingScreen";

export default function RecordMeetingPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = use(params);
  return <RecordMeetingScreen meetingId={meetingId} />;
}
