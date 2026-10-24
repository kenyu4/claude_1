"use client";

// アップロードした資料の原本をブラウザの IndexedDB に保存し、「根拠を確認」から開けるようにする。
// 保存に失敗してもアプリの動作には影響しない（原本表示ができなくなるだけ）。

const DB_NAME = "sapix-home-study-files";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function putFile(id: string, blob: Blob): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.put(blob, id));
  } catch {
    // 容量不足など。原本表示ができないだけなので無視する
  }
}

export async function getFile(id: string): Promise<Blob | null> {
  try {
    const v = await withStore<Blob | undefined>("readonly", (s) => s.get(id));
    return v ?? null;
  } catch {
    return null;
  }
}

export async function deleteFile(id: string): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.delete(id));
  } catch {
    // noop
  }
}
