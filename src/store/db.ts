/**
 * IndexedDB storage abstraction: batch writes, migration from localStorage, indexed queries.
 * Falls back to localStorage if IndexedDB is unavailable.
 */

const DB_NAME = 'shadowflow-db';
const DB_VERSION = 1;
const STORE_NAMES = ['courses', 'lessons', 'sentences', 'reviewStates', 'wordStats'] as const;
type StoreName = (typeof STORE_NAMES)[number];

const LOCALSTORAGE_KEYS: Record<StoreName, string> = {
  courses: 'shadowflow-courses',
  lessons: 'shadowflow-lessons',
  sentences: 'shadowflow-sentences',
  reviewStates: 'shadowflow-review-states',
  wordStats: 'shadowflow-word-stats',
};

let dbInstance: IDBDatabase | null = null;
let useIndexedDB = true;

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

const MAX_RETRIES = 3;

function openDBInternal(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('lessons')) {
        db.createObjectStore('lessons', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sentences')) {
        const sentencesStore = db.createObjectStore('sentences', { keyPath: 'id' });
        sentencesStore.createIndex('lessonId', 'lessonId', { unique: false });
      }
      if (!db.objectStoreNames.contains('reviewStates')) {
        const reviewStore = db.createObjectStore('reviewStates', { keyPath: ['sentenceId', 'mode'] });
        reviewStore.createIndex('sentenceId', 'sentenceId', { unique: false });
        reviewStore.createIndex('mode', 'mode', { unique: false });
      }
      if (!db.objectStoreNames.contains('wordStats')) {
        db.createObjectStore('wordStats', { keyPath: 'id' });
      }
    };
  });
}

export async function openDB(): Promise<IDBDatabase | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await openDBInternal();
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        useIndexedDB = false;
        return null;
      }
    }
  }
  return null;
}

export async function put<T extends object>(
  storeName: StoreName,
  _key: IDBValidKey,
  value: T
): Promise<void> {
  if (!dbInstance) return;
  return new Promise((resolve, reject) => {
    const tx = dbInstance!.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function putMany<T extends object>(
  storeName: StoreName,
  items: T[]
): Promise<void> {
  if (!dbInstance || items.length === 0) return;
  return new Promise((resolve, reject) => {
    const tx = dbInstance!.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  if (!dbInstance) return;
  return new Promise((resolve, reject) => {
    const tx = dbInstance!.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteKey(storeName: StoreName, key: IDBValidKey): Promise<void> {
  if (!dbInstance) return;
  return new Promise((resolve, reject) => {
    const tx = dbInstance!.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  if (!dbInstance) return undefined;
  return new Promise((resolve, reject) => {
    const tx = dbInstance!.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  if (!dbInstance) return [];
  return new Promise((resolve, reject) => {
    const tx = dbInstance!.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function getByIndex<T>(
  storeName: StoreName,
  indexName: string,
  key: IDBValidKey
): Promise<T[]> {
  if (!dbInstance) return [];
  return new Promise((resolve, reject) => {
    const tx = dbInstance!.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(key);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export interface TransactionWriter {
  put<T extends object>(storeName: StoreName, _key: IDBValidKey, value: T): void;
  putMany<T extends object>(storeName: StoreName, items: T[]): void;
  deleteKey(storeName: StoreName, key: IDBValidKey): void;
}

/** Run a single transaction spanning multiple stores. Aborts on throw. */
export async function runTransaction(
  storeNames: StoreName[],
  callback: (tx: TransactionWriter) => void | Promise<void>
): Promise<void> {
  if (!dbInstance) return;
  return new Promise((resolve, reject) => {
    const tx = dbInstance!.transaction(storeNames, 'readwrite');
    const writer: TransactionWriter = {
      put(storeName, _key, value) {
        tx.objectStore(storeName).put(value);
      },
      putMany(storeName, items) {
        const store = tx.objectStore(storeName);
        for (const item of items) store.put(item);
      },
      deleteKey(storeName, key) {
        tx.objectStore(storeName).delete(key);
      },
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    Promise.resolve(callback(writer)).catch(reject);
  });
}

export async function migrateFromLocalStorage(): Promise<void> {
  if (!dbInstance) return;
  for (const storeName of STORE_NAMES) {
    const lsKey = LOCALSTORAGE_KEYS[storeName];
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : parsed != null ? [parsed] : [];
      if (items.length === 0) continue;
      await putMany(storeName, items as object[]);
    } catch (_) {
      // ignore per-key migration errors
    }
  }
}

export function getUseIndexedDB(): boolean {
  return useIndexedDB;
}

export function setUseIndexedDB(value: boolean): void {
  useIndexedDB = value;
}

export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export type { StoreName };
