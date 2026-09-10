"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createMeeting, defaultMeetingTitle } from "@/lib/storage/meetings";

const TITLE_MAX = 120;
const TAG_MAX_COUNT = 10;
const TAG_MAX_LENGTH = 20;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function NewMeetingForm() {
  const router = useRouter();
  const now = useRef(new Date());
  const submittingRef = useRef(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [title, setTitle] = useState("");
  const [dateValue, setDateValue] = useState(() => toDateValue(now.current));
  const [timeValue, setTimeValue] = useState(() => toTimeValue(now.current));
  const [attendees, setAttendees] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addTag() {
    const value = tagDraft.trim();
    if (!value) return;
    if (value.length > TAG_MAX_LENGTH) {
      setTagError(`태그는 ${TAG_MAX_LENGTH}자까지 입력할 수 있습니다.`);
      return;
    }
    if (tags.length >= TAG_MAX_COUNT) {
      setTagError(`태그는 ${TAG_MAX_COUNT}개까지 추가할 수 있습니다.`);
      return;
    }
    if (tags.includes(value)) {
      setTagDraft("");
      setTagError(null);
      return;
    }
    setTags((prev) => [...prev, value]);
    setTagDraft("");
    setTagError(null);
  }

  async function handleSubmit() {
    if (submittingRef.current) return;

    const startedAt = parseLocalDateTime(dateValue, timeValue);
    const nextTitle = title.trim();
    let blocked = false;

    if (title.length > TITLE_MAX) {
      setTitleError(`최대 ${TITLE_MAX}자까지 입력할 수 있습니다.`);
      blocked = true;
    } else {
      setTitleError(null);
    }

    if (!startedAt) {
      setDateError("유효한 회의 일시를 입력해 주세요.");
      blocked = true;
    } else {
      setDateError(null);
    }

    if (tags.length > TAG_MAX_COUNT) {
      setTagError(`태그는 ${TAG_MAX_COUNT}개까지 추가할 수 있습니다.`);
      blocked = true;
    }

    if (blocked) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const meetingDate = startedAt ?? new Date();
      const meeting = await createMeeting({
        title: nextTitle.length === 0 ? defaultMeetingTitle(meetingDate) : nextTitle,
        startedAt: meetingDate.toISOString(),
        timezone,
        attendees: attendees.trim(),
        tags,
      });
      router.replace(`/meetings/${meeting.id}/record`);
    } catch {
      submittingRef.current = false;
      setSubmitting(false);
      setSubmitError("회의를 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col px-4 py-5 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="w-fit text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
      >
        ← 회의 목록
      </Link>

      <div className="mx-auto mt-8 w-full max-w-xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          새 회의
        </h1>

        <div className="mt-8 space-y-6">
          <label className="block">
            <span className="flex items-center justify-between text-sm font-medium">
              회의 제목
              <span className="font-normal text-[var(--muted)]">
                {title.length} / {TITLE_MAX}
              </span>
            </span>
            <input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(event) => {
                setTitle(event.target.value.slice(0, TITLE_MAX));
                setTitleError(null);
              }}
              className="field mt-2 w-full"
              placeholder="미입력 시 자동으로 제목을 만듭니다"
              aria-invalid={titleError ? true : undefined}
            />
            {titleError && (
              <p className="mt-2 text-sm text-[var(--danger)]">{titleError}</p>
            )}
          </label>

          <fieldset>
            <legend className="text-sm font-medium">회의 일시</legend>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateValue}
                onChange={(event) => {
                  setDateValue(event.target.value);
                  setDateError(null);
                }}
                aria-label="회의 날짜"
                className="field"
              />
              <input
                type="time"
                value={timeValue}
                onChange={(event) => {
                  setTimeValue(event.target.value);
                  setDateError(null);
                }}
                aria-label="회의 시각"
                className="field"
              />
              <span className="text-xs text-[var(--muted)]">{timezone}</span>
            </div>
            {dateError && (
              <p className="mt-2 text-sm text-[var(--danger)]">{dateError}</p>
            )}
          </fieldset>

          <label className="block">
            <span className="flex items-center justify-between text-sm font-medium">
              참석자
              <span className="font-normal text-[var(--muted)]">선택 사항</span>
            </span>
            <input
              value={attendees}
              onChange={(event) => setAttendees(event.target.value)}
              className="field mt-2 w-full"
              placeholder="김OO, 이OO"
            />
          </label>

          <div>
            <span className="flex items-center justify-between text-sm font-medium">
              태그
              <span className="font-normal text-[var(--muted)]">선택 사항</span>
            </span>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/70 px-2.5 py-1 text-sm ring-1 ring-[var(--border)]"
                  >
                    {tag}
                    <button
                      type="button"
                      className="text-[var(--muted)] hover:text-[var(--foreground)]"
                      aria-label={`${tag} 태그 삭제`}
                      onClick={() =>
                        setTags((prev) => prev.filter((item) => item !== tag))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <input
                value={tagDraft}
                maxLength={TAG_MAX_LENGTH}
                onChange={(event) => {
                  setTagDraft(event.target.value.slice(0, TAG_MAX_LENGTH));
                  setTagError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
                className="field min-w-0 flex-1"
                placeholder="태그 입력"
                aria-label="태그 추가"
                disabled={tags.length >= TAG_MAX_COUNT}
              />
              <button
                type="button"
                className="btn btn-ghost px-3 py-2"
                onClick={addTag}
                disabled={tags.length >= TAG_MAX_COUNT}
              >
                + 태그 추가
              </button>
            </div>
            {tagError && (
              <p className="mt-2 text-sm text-[var(--danger)]">{tagError}</p>
            )}
          </div>
        </div>

        {submitError && (
          <p className="mt-6 text-sm text-[var(--danger)]" role="alert">
            {submitError}
          </p>
        )}

        <div className="mt-10 flex justify-end gap-2">
          <Link href="/" className="btn btn-ghost px-4 py-2.5">
            취소
          </Link>
          <button
            type="button"
            className="btn btn-primary px-4 py-2.5"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? "저장 중…" : "회의 시작"}
          </button>
        </div>
      </div>
    </div>
  );
}
