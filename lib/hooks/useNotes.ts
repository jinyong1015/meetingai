"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteNote as deleteNoteFromDb,
  getNotesByMeeting,
  putNote,
  putNotes,
} from "@/lib/storage/notes";
import {
  NOTE_MAX_TOTAL_CHARS,
  type Note,
  type SaveStatus,
} from "@/lib/types/note";
import { createId } from "@/lib/utils/format-time";

const IDLE_SAVE_MS = 1000;
const MAX_SAVE_INTERVAL_MS = 5000;

type UseNotesOptions = {
  meetingId: string;
  /** Elapsed recording seconds excluding pause. Null when not recording. */
  recordingElapsedSec: number | null;
};

function totalChars(notes: Note[]): number {
  return notes.reduce((sum, note) => sum + note.content.length, 0);
}

export function useNotes({ meetingId, recordingElapsedSec }: UseNotesOptions) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [draftImportant, setDraftImportant] = useState(false);
  const [draftIncludeInAI, setDraftIncludeInAI] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  const notesRef = useRef(notes);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const persistDirty = useCallback(async () => {
    if (isSavingRef.current) return;
    const dirtyIds = Array.from(dirtyIdsRef.current);
    if (dirtyIds.length === 0) return;

    isSavingRef.current = true;
    setSaveStatus("saving");

    try {
      const toSave = notesRef.current.filter((note) => dirtyIds.includes(note.id));
      await putNotes(toSave);
      dirtyIds.forEach((id) => dirtyIdsRef.current.delete(id));
      setSaveStatus("saved");
      setLastSavedAt(new Date());
    } catch {
      setSaveStatus("error");
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      void persistDirty();
    }, IDLE_SAVE_MS);

    if (!maxTimerRef.current) {
      maxTimerRef.current = setTimeout(() => {
        maxTimerRef.current = null;
        void persistDirty();
      }, MAX_SAVE_INTERVAL_MS);
    }
  }, [persistDirty]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getNotesByMeeting(meetingId);
        if (cancelled) return;
        loaded.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        setNotes(loaded);
        setSaveStatus(loaded.length > 0 ? "saved" : "idle");
      } catch {
        if (!cancelled) setSaveStatus("error");
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  const markDirty = useCallback(
    (noteId: string) => {
      dirtyIdsRef.current.add(noteId);
      scheduleSave();
    },
    [scheduleSave],
  );

  const remainingChars = NOTE_MAX_TOTAL_CHARS - totalChars(notes) - draft.length;

  const updateDraft = useCallback(
    (value: string) => {
      const used = totalChars(notes);
      if (used + value.length > NOTE_MAX_TOTAL_CHARS) {
        const allowed = Math.max(0, NOTE_MAX_TOTAL_CHARS - used);
        setDraft(value.slice(0, allowed));
        setLimitMessage(
          `메모 본문 합계는 ${NOTE_MAX_TOTAL_CHARS.toLocaleString("ko-KR")}자를 넘을 수 없습니다.`,
        );
        return;
      }
      setLimitMessage(null);
      setDraft(value);
    },
    [notes],
  );

  const addNote = useCallback(async () => {
    const content = draft.trim();
    if (!content) return;

    if (totalChars(notes) + content.length > NOTE_MAX_TOTAL_CHARS) {
      setLimitMessage(
        `메모 본문 합계는 ${NOTE_MAX_TOTAL_CHARS.toLocaleString("ko-KR")}자를 넘을 수 없습니다.`,
      );
      return;
    }

    const now = new Date().toISOString();
    const note: Note = {
      id: createId("note"),
      meetingId,
      content,
      timestampSec:
        recordingElapsedSec !== null ? Math.floor(recordingElapsedSec) : null,
      important: draftImportant,
      includeInAI: draftIncludeInAI,
      createdAt: now,
      updatedAt: now,
    };

    setNotes((prev) => [...prev, note]);
    setDraft("");
    setDraftImportant(false);
    setDraftIncludeInAI(true);
    setLimitMessage(null);
    setSaveStatus("saving");

    try {
      await putNote(note);
      setSaveStatus("saved");
      setLastSavedAt(new Date());
    } catch {
      dirtyIdsRef.current.add(note.id);
      setSaveStatus("error");
    }
  }, [
    draft,
    draftImportant,
    draftIncludeInAI,
    meetingId,
    notes,
    recordingElapsedSec,
  ]);

  const updateNoteContent = useCallback(
    (noteId: string, content: string) => {
      setNotes((prev) => {
        const others = prev.filter((n) => n.id !== noteId);
        const current = prev.find((n) => n.id === noteId);
        if (!current) return prev;

        const nextLength = totalChars(others) + content.length;
        if (nextLength > NOTE_MAX_TOTAL_CHARS) {
          setLimitMessage(
            `메모 본문 합계는 ${NOTE_MAX_TOTAL_CHARS.toLocaleString("ko-KR")}자를 넘을 수 없습니다.`,
          );
          const allowed = Math.max(0, NOTE_MAX_TOTAL_CHARS - totalChars(others));
          const trimmed = content.slice(0, allowed);
          markDirty(noteId);
          return prev.map((n) =>
            n.id === noteId
              ? { ...n, content: trimmed, updatedAt: new Date().toISOString() }
              : n,
          );
        }

        setLimitMessage(null);
        markDirty(noteId);
        return prev.map((n) =>
          n.id === noteId
            ? { ...n, content, updatedAt: new Date().toISOString() }
            : n,
        );
      });
    },
    [markDirty],
  );

  const toggleImportant = useCallback(
    (noteId: string) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? {
                ...n,
                important: !n.important,
                updatedAt: new Date().toISOString(),
              }
            : n,
        ),
      );
      markDirty(noteId);
    },
    [markDirty],
  );

  const toggleIncludeInAI = useCallback(
    (noteId: string) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? {
                ...n,
                includeInAI: !n.includeInAI,
                updatedAt: new Date().toISOString(),
              }
            : n,
        ),
      );
      markDirty(noteId);
    },
    [markDirty],
  );

  const removeNote = useCallback(async (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    dirtyIdsRef.current.delete(noteId);
    setSaveStatus("saving");
    try {
      await deleteNoteFromDb(noteId);
      setSaveStatus("saved");
      setLastSavedAt(new Date());
      setLimitMessage(null);
    } catch {
      setSaveStatus("error");
    }
  }, []);

  const retrySave = useCallback(() => {
    void persistDirty();
  }, [persistDirty]);

  return {
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
  };
}
