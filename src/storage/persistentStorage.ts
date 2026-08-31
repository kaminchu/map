export type PersistentStorageStatus = "granted" | "unprotected" | "unsupported";

export interface StorageEstimate {
  usage?: number;
  quota?: number;
}

export async function getStorageEstimate(): Promise<StorageEstimate> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return {};
  return navigator.storage.estimate();
}

export async function getPersistentStorageStatus(): Promise<PersistentStorageStatus> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) return "unsupported";
  try {
    return (await navigator.storage.persisted()) ? "granted" : "unprotected";
  } catch {
    return "unprotected";
  }
}

export async function requestPersistentStorage(): Promise<PersistentStorageStatus> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return "unsupported";
  try {
    return (await navigator.storage.persist()) ? "granted" : "unprotected";
  } catch {
    return "unprotected";
  }
}
