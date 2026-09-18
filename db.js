// Tiny wrapper around IndexedDB, the browser's built-in on-device database.
// Everything is stored on this phone only.
const DB = (() => {
  const NAME = 'exercise-planner';
  const VERSION = 4;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('exercises')) {
          db.createObjectStore('exercises', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tags')) {
          db.createObjectStore('tags', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('workouts')) {
          db.createObjectStore('workouts', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // Another tab has opened a newer version: close ours and reload so it can upgrade.
        db.onversionchange = () => { db.close(); location.reload(); };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Database is open in another tab. Close it and reload.'));
    });
    return dbPromise;
  }

  function run(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  function putMany(store, items) {
    return run(store, 'readwrite', s => { items.forEach(i => s.put(i)); });
  }

  return {
    all: store => run(store, 'readonly', s => s.getAll()),
    get: (store, id) => run(store, 'readonly', s => s.get(id)),
    put: (store, item) => run(store, 'readwrite', s => s.put(item)),
    putMany,
    remove: (store, id) => run(store, 'readwrite', s => s.delete(id)),
  };
})();
