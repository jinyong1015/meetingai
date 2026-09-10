import type { Note } from "@/lib/types/note";

const DB_NAME = "meetingai";
const DB_VERSION = 1;
const NOTES_STORE = "notes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        const store = db.createObjectStore(NOTES_STORE, { keyPath: "id" });
        store.createIndex("meetingId", "meetingId", { unique: false });
      }
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function getNotesByMeeting(meetingId: string): Promise<Note[]> {
  const db = await openDb();
  const tx = db.transaction(NOTES_STORE, "readonly");
  const store = tx.objectStore(NOTES_STORE);
  const index = store.index("meetingId");
  const notes = await requestToPromise(index.getAll(meetingId));
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
