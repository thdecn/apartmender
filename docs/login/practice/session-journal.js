const DATABASE = "apartmender-practice-v1";

// A whole Student partition is changed in one IndexedDB transaction. In
// particular, an Open marker cannot disappear without its queued event being
// written in the same transaction.
export function createSessionJournal(indexedDB) {
  let database;
  async function connection() {
    if (database) return database;
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("students");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Practice storage is blocked"));
    });
    return database;
  }

  return Object.freeze({
    async read(userId) {
      const db = await connection();
      return new Promise((resolve, reject) => {
        const request = db.transaction("students").objectStore("students").get(userId);
        request.onsuccess = () => resolve(request.result ?? { open: {}, queue: {} });
        request.onerror = () => reject(request.error);
      });
    },
    async change(userId, update) {
      const db = await connection();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("students", "readwrite");
        const bucket = transaction.objectStore("students");
        let result;
        const request = bucket.get(userId);
        request.onsuccess = () => {
          try {
            const partition = request.result ?? { open: {}, queue: {} };
            result = update(partition);
            bucket.put(partition, userId);
          } catch (error) {
            transaction.abort();
            reject(error);
          }
        };
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error("Practice write aborted"));
      });
    },
    async remove(userId) {
      const db = await connection();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("students", "readwrite");
        transaction.objectStore("students").delete(userId);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    },
  });
}

export function createMemorySessionJournal() {
  const partitions = new Map();
  return Object.freeze({
    async read(userId) {
      return structuredClone(partitions.get(userId) ?? { open: {}, queue: {} });
    },
    async change(userId, update) {
      const partition = structuredClone(partitions.get(userId) ?? { open: {}, queue: {} });
      const result = update(partition);
      partitions.set(userId, partition);
      return result;
    },
    async remove(userId) { partitions.delete(userId); },
  });
}
