/**
 * IndexedDB rather than localStorage: the scan queue has to survive the tab closing, the
 * phone dying, and a reload with no signal, and localStorage is synchronous and is the first
 * thing a browser clears under memory pressure. No wrapper library -- two stores and four
 * operations does not justify one.
 */
const DB_NAME = "gate-door";
const DB_VERSION = 1;
export const MANIFEST_STORE = "manifest";
export const SCAN_STORE = "scans";

let connection: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MANIFEST_STORE)) db.createObjectStore(MANIFEST_STORE, { keyPath: "eventId" });
      if (!db.objectStoreNames.contains(SCAN_STORE)) db.createObjectStore(SCAN_STORE, { keyPath: "clientScanId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return connection;
}

function run<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = action(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const idb = {
  get: <T>(store: string, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key)),
  getAll: <T>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
  put: <T>(store: string, value: T) => run(store, "readwrite", (s) => s.put(value as never)),
  remove: (store: string, key: string) => run(store, "readwrite", (s) => s.delete(key)),
};
