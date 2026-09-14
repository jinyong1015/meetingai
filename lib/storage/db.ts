const DB_NAME = "meetingai";
const DB_VERSION = 5;

export const NOTES_STORE = "notes";
export const MEETINGS_STORE = "meetings";
export const SETTINGS_STORE = "settings";
export const TRANSCRIPTS_STORE = "transcripts";
export const GENERATIONS_STORE = "generations";

function ensureStores(db: IDBDatabase, oldVersion: number) {
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

  if (oldVersion < 5 && !db.objectStoreNames.contains(GENERATIONS_STORE)) {
    db.createObjectStore(GENERATIONS_STORE, { keyPath: "meetingId" });
  }
}

/**
 * Open IndexedDB. If a stale client bundle requests an older version after the
 * DB was already upgraded (HMR / mixed chunks), fall back to opening the
 * existing DB without a version pin so reads/writes can continue.
 */
export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      const err = request.error;
      if (err?.name === "VersionError") {
        const fallback = indexedDB.open(DB_NAME);
        fallback.onsuccess = () => resolve(fallback.result);
        fallback.onerror = () =>
          reject(fallback.error ?? err ?? new Error("IndexedDB open failed"));
        return;
      }
      reject(err ?? new Error("IndexedDB open failed"));
    };
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      ensureStores(request.result, event.oldVersion);
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
