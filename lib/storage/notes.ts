import type { Note } from "@/lib/types/note";
import { NOTES_STORE, openDb, requestToPromise } from "@/lib/storage/db";

export async function getNotesByMeeting(meetingId: string): Promise<Note[]> {
  const db = await openDb();
  const tx = db.transaction(NOTES_STORE, "readonly");
  const store = tx.objectStore(NOTES_STORE);
  const index = store.index("meetingId");
  const notes = await requestToPromise(index.getAll(meetingId));
  db.close();
  return notes as Note[];
}

export async function getAllNotes(): Promise<Note[]> {
  const db = await openDb();
  const tx = db.transaction(NOTES_STORE, "readonly");
  const notes = await requestToPromise(tx.objectStore(NOTES_STORE).getAll());
  db.close();
  return notes as Note[];
}

export async function putNote(note: Note) {
  const db = await openDb();
  const tx = db.transaction(NOTES_STORE, "readwrite");
  await requestToPromise(tx.objectStore(NOTES_STORE).put(note));
  db.close();
}

export async function putNotes(notes: Note[]) {
  if (notes.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(NOTES_STORE, "readwrite");
  const store = tx.objectStore(NOTES_STORE);
  await Promise.all(notes.map((note) => requestToPromise(store.put(note))));
  db.close();
}

export async function deleteNote(noteId: string) {
  const db = await openDb();
  const tx = db.transaction(NOTES_STORE, "readwrite");
  await requestToPromise(tx.objectStore(NOTES_STORE).delete(noteId));
  db.close();
}

export async function deleteNotesByMeeting(meetingId: string) {
  const notes = await getNotesByMeeting(meetingId);
  if (notes.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(NOTES_STORE, "readwrite");
  const store = tx.objectStore(NOTES_STORE);
  await Promise.all(notes.map((note) => requestToPromise(store.delete(note.id))));
  db.close();
}

/** Removes notes whose meeting no longer exists (e.g. leftover from early builds). */
export async function deleteOrphanNotes(validMeetingIds: Set<string>): Promise<number> {
  const notes = await getAllNotes();
  const orphans = notes.filter((note) => !validMeetingIds.has(note.meetingId));
  if (orphans.length === 0) return 0;

  const db = await openDb();
  const tx = db.transaction(NOTES_STORE, "readwrite");
  const store = tx.objectStore(NOTES_STORE);
  await Promise.all(orphans.map((note) => requestToPromise(store.delete(note.id))));
  db.close();
  return orphans.length;
}

export async function findMeetingIdsByNoteQuery(query: string): Promise<string[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const notes = await getAllNotes();
  const ids = new Set<string>();
  for (const note of notes) {
    if (note.content.toLowerCase().includes(q)) ids.add(note.meetingId);
  }
  return [...ids];
}
