const DB_NAME = "meetingai";
const DB_VERSION = 4;

export const NOTES_STORE = "notes";
export const MEETINGS_STORE = "meetings";
export const SETTINGS_STORE = "settings";
export const TRANSCRIPTS_STORE = "transcripts";

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1 && !db.objectStoreNames.contains(NOTES_STORE)) {
        const store = db.createObjectStore(NOTES_STORE, { keyPath: "id" });
        store.createIndex("meetingId", "meetingId", { unique: false });
      }

      if (oldVersion < 2 && !db.objectStoreNames.contains(MEETINGS_STORE)) {
        const store = db.createObjectStore(MEETINGS_STORE, { keyPath: "id" });
        store.createIndex("startedAt", "startedAt", { unique: false });
      }

      if (oldVersion < 3 && !db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
      }

      if (oldVersion < 4 && !db.objectStoreNames.contains(TRANSCRIPTS_STORE)) {
        db.createObjectStore(TRANSCRIPTS_STORE, { keyPath: "meetingId" });
      }
    };
  });
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}
