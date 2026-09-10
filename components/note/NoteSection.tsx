"use client";

import { SaveIndicator } from "@/components/common/SaveIndicator";
import { NoteEditor } from "@/components/note/NoteEditor";
import { NoteItem } from "@/components/note/NoteItem";
import { useNotes } from "@/lib/hooks/useNotes";

type NoteSectionProps = {
  meetingId: string;
  recordingElapsedSec: number | null;
  onSeekTimestamp?: (seconds: number) => void;
};

export function NoteSection({
  meetingId,
  recordingElapsedSec,
  onSeekTimestamp,
}: NoteSectionProps) {
  const {
    notes,
    draft,
    draftImportant,
    draftIncludeInAI,
    saveStatus,
    lastSavedAt,
    isHydrated,
    limitMessage,
    remainingChars,
    setDraftImportant,
    setDraftIncludeInAI,
    updateDraft,
    addNote,
    updateNoteContent,
    toggleImportant,
    toggleIncludeInAI,
    removeNote,
    retrySave,
  } = useNotes({ meetingId, recordingElapsedSec });

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-labelledby="note-section-title"
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2
            id="note-section-title"
            className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--foreground)]"
          >
            메모
          </h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--muted)]">
            회의 중 자유롭게 적어 두세요. 시점이 붙고, AI 반영을 끄면 생성에
            포함되지 않습니다.
          </p>
        </div>
        <SaveIndicator
          status={saveStatus}
          lastSavedAt={lastSavedAt}
          onRetry={retrySave}
        />
      </div>

      <div className="mb-6">
        <NoteEditor
          value={draft}
          important={draftImportant}
          includeInAI={draftIncludeInAI}
          remainingChars={remainingChars}
          limitMessage={limitMessage}
          recordingElapsedSec={recordingElapsedSec}
          onChange={updateDraft}
          onImportantChange={setDraftImportant}
          onIncludeInAIChange={setDraftIncludeInAI}
          onSubmit={() => void addNote()}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!isHydrated ? (
          <p className="py-10 text-center text-sm text-[var(--muted)]">
            메모를 불러오는 중…
          </p>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <div className="mb-3 size-10 rounded-2xl bg-[var(--accent-soft)]" aria-hidden />
            <p className="text-sm font-medium text-[var(--foreground)]">
              아직 메모가 없습니다
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              위에서 회의 내용을 남겨 보세요
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notes.map((note, index) => (
              <li
                key={note.id}
                className="animate-rise"
                style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              >
                <NoteItem
                  note={note}
                  onContentChange={updateNoteContent}
                  onToggleImportant={toggleImportant}
                  onToggleIncludeInAI={toggleIncludeInAI}
                  onDelete={(id) => void removeNote(id)}
                  onSeekTimestamp={onSeekTimestamp}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
