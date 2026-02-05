const DB_NAME = 'katanos_storage';
const STORE_NAME = 'kv';
const DB_VERSION = 1;
const MIGRATION_FLAG = 'katanos_idb_migrated_v1';

let dbPromise: Promise<IDBDatabase> | null = null;
let initPromise: Promise<void> | null = null;
let ready = false;
let idbAvailable = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
let migrated = false;
const cache = new Map<string, string>();

const openDb = () => {
  if (!idbAvailable) {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
};

const loadAllFromDb = async (db: IDBDatabase) => {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const key = String(cursor.key);
        cache.set(key, String(cursor.value));
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
};

const writeEntriesToDb = async (entries: Array<[string, string]>) => {
  if (!entries.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    entries.forEach(([key, value]) => {
      store.put(value, key);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const initStorage = async (migrateKeys: string[]) => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!idbAvailable) {
      ready = true;
      return;
    }
    try {
      migrated = typeof window !== 'undefined' && window.localStorage.getItem(MIGRATION_FLAG) === '1';
      const db = await openDb();
      await loadAllFromDb(db);
      const toMigrate: Array<[string, string]> = [];
      migrateKeys.forEach((key) => {
        if (cache.has(key)) return;
        const value = window.localStorage.getItem(key);
        if (value === null) return;
        cache.set(key, value);
        toMigrate.push([key, value]);
      });
      if (toMigrate.length) {
        await writeEntriesToDb(toMigrate);
        toMigrate.forEach(([key]) => window.localStorage.removeItem(key));
        window.localStorage.setItem(MIGRATION_FLAG, '1');
        migrated = true;
      }
      ready = true;
    } catch (error) {
      console.error('IndexedDB init failed, falling back to localStorage.', error);
      idbAvailable = false;
      migrated = false;
      ready = true;
    }
  })();
  return initPromise;
};

export const storageGetRaw = (key: string): string | null => {
  if (cache.has(key)) return cache.get(key) ?? null;
  if (!ready || !idbAvailable) {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  }
  return null;
};

export const storageSetRaw = (key: string, value: string) => {
  cache.set(key, value);
  if (!idbAvailable) {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    return;
  }
  void (async () => {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => {
        window.localStorage.removeItem(key);
      };
    } catch (error) {
      console.error('IndexedDB write failed, falling back to localStorage.', error);
      window.localStorage.setItem(key, value);
    }
  })();
};

export const storageRemoveRaw = (key: string) => {
  cache.delete(key);
  if (!idbAvailable) {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    return;
  }
  void (async () => {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => {
        window.localStorage.removeItem(key);
      };
    } catch (error) {
      console.error('IndexedDB delete failed, falling back to localStorage.', error);
      window.localStorage.removeItem(key);
    }
  })();
};

export const getStorageStatus = () => ({
  ready,
  idbAvailable,
  migrated,
});
