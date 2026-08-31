export type TileUnavailableReason = "offline-miss" | "network" | "http";

export class TileUnavailableError extends Error {
  readonly reason: TileUnavailableReason;

  constructor(reason: TileUnavailableReason, message?: string) {
    super(message ?? reason);
    this.name = "TileUnavailableError";
    this.reason = reason;
  }
}

export class StorageUnavailableError extends Error {
  constructor(message = "Storage is unavailable") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

export class QuotaExceededAppError extends Error {
  constructor(message = "Storage quota exceeded") {
    super(message);
    this.name = "QuotaExceededAppError";
  }
}

export class TileValidationError extends Error {
  constructor(message = "Invalid tile response") {
    super(message);
    this.name = "TileValidationError";
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof QuotaExceededAppError || isQuotaError(error)) {
    return "ストレージの空き容量が不足しています。一時キャッシュを削除するか、保存範囲を小さくしてください。";
  }
  if (error instanceof StorageUnavailableError)
    return "このブラウザーでは保存機能を利用できません。";
  if (error instanceof TileUnavailableError && error.reason === "offline-miss") {
    return "オフラインで、この地域の地図が保存されていません。";
  }
  return "処理に失敗しました。時間をおいて再度お試しください。";
}
