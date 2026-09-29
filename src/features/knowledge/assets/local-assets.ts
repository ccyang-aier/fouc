'use client';

import { hashBlobSha256 } from './sha256';

interface StoredLocalAsset { key: string; blob: Blob; name: string; mime: string; size: number }

const DB_NAME = 'fouc-local-assets';
const STORE = 'assets';

function openLocalAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: 'key' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本机资源库'));
  });
}

function transact<T>(operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: Error) => void) => void, mode: IDBTransactionMode): Promise<T> {
  return openLocalAssetDb().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    let result: T;
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('本机资源存储失败')); };
    operation(transaction.objectStore(STORE), (value) => { result = value; }, reject);
  }));
}

/** The document stores only asset:<sha256>; bytes stay in browser IndexedDB, isolated by workspace. */
export async function saveLocalAsset(workspaceId: string, file: File, onProgress?: (ratio: number) => void): Promise<string> {
  const hash = await hashBlobSha256(file, { onProgress });
  const key = `${workspaceId}:${hash}`;
  await transact<void>((store, resolve, reject) => {
    const request = store.put({ key, blob: file, name: file.name, mime: file.type || 'application/octet-stream', size: file.size } satisfies StoredLocalAsset);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('本机资源写入失败'));
  }, 'readwrite');
  return `asset:${hash}`;
}

export async function readLocalAsset(workspaceId: string, source: string): Promise<StoredLocalAsset | null> {
  if (!/^asset:[a-f0-9]{64}$/.test(source)) return null;
  return transact<StoredLocalAsset | null>((store, resolve, reject) => {
    const request = store.get(`${workspaceId}:${source.slice(6)}`);
    request.onsuccess = () => resolve((request.result as StoredLocalAsset | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('本机资源读取失败'));
  }, 'readonly');
}
