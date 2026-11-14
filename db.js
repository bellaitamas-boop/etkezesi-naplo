const DB_NAME = 'etkezesi-naplo';
const DB_VERSION = 1;
const STORES = ['entries', 'settings', 'drafts', 'tombstones', 'metadata'];

let dbPromise;

export function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Az adatbázis frissítését egy másik megnyitott ablak blokkolja.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: 'id' });
        store.createIndex('mealDate', 'mealDate');
        store.createIndex('updatedAt', 'updatedAt');
      }
      for (const name of STORES.slice(1)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
  return dbPromise;
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  const db = await openDatabase();
  return requestAsPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
}

export async function getByKey(storeName, key) {
  const db = await openDatabase();
  return requestAsPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
}

export async function put(storeName, value) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(value);
  return transactionDone(transaction);
}

export async function remove(storeName, key) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(key);
  return transactionDone(transaction);
}

export function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Adatbázishiba történt.'));
    transaction.onabort = () => reject(transaction.error || new Error('A művelet megszakadt.'));
  });
}

export async function replaceJournalAtomically(payload) {
  const db = await openDatabase();
  const transaction = db.transaction(STORES, 'readwrite');
  const entries = transaction.objectStore('entries');
  const tombstones = transaction.objectStore('tombstones');
  const drafts = transaction.objectStore('drafts');
  entries.clear();
  tombstones.clear();
  drafts.clear();
  for (const item of payload.entries || []) entries.put(item);
  for (const item of payload.tombstones || []) tombstones.put(item);
  if (payload.draft) drafts.put({ ...payload.draft, key: 'active' });
  if (payload.settings) transaction.objectStore('settings').put({ ...payload.settings, key: 'app' });
  return transactionDone(transaction);
}

export async function mergeJournalAtomically(plan) {
  const db = await openDatabase();
  const transaction = db.transaction(STORES, 'readwrite');
  const entries = transaction.objectStore('entries');
  const tombstones = transaction.objectStore('tombstones');
  for (const item of [...plan.add, ...plan.update]) entries.put(item);
  for (const id of plan.deleteIds) entries.delete(id);
  for (const item of plan.tombstones || []) tombstones.put(item);
  if (plan.importSettings) transaction.objectStore('settings').put({ ...plan.importSettings, key: 'app' });
  if (plan.importDraft) transaction.objectStore('drafts').put({ ...plan.importDraft, key: 'active' });
  return transactionDone(transaction);
}

export async function deleteMealDataAtomically() {
  const db = await openDatabase();
  const transaction = db.transaction(['entries', 'drafts', 'tombstones'], 'readwrite');
  transaction.objectStore('entries').clear();
  transaction.objectStore('drafts').clear();
  transaction.objectStore('tombstones').clear();
  return transactionDone(transaction);
}
