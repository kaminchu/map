import { TileUnavailableError, TileValidationError, isAbortError } from "../lib/errors";
import { logger } from "../lib/logger";
import type { MapTileSource } from "../map/tileSources";
import type { FetchedTile, TileCoordinate } from "./types";

export interface FetchTileOptions {
  signal?: AbortSignal;
  etag?: string;
  lastModified?: string;
  allowNotModified?: boolean;
}

function contentTypeOf(response: Response): string {
  return (response.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function validContentType(value: string, source: MapTileSource): boolean {
  return source.contentTypes.some(
    (allowed) =>
      allowed === value || (allowed.endsWith("/*") && value.startsWith(`${allowed.slice(0, -1)}`)),
  );
}

function validateLength(response: Response, data: ArrayBuffer): void {
  const header = response.headers.get("content-length");
  if (
    data.byteLength === 0 ||
    (header !== null && (Number(header) <= 0 || Number(header) !== data.byteLength))
  )
    throw new TileValidationError("Invalid tile body length");
}

export async function fetchTile(
  source: MapTileSource,
  tile: TileCoordinate,
  options: FetchTileOptions = {},
): Promise<FetchedTile> {
  const headers: Record<string, string> = {};
  if (options.etag) headers["If-None-Match"] = options.etag;
  if (options.lastModified) headers["If-Modified-Since"] = options.lastModified;
  const url = source.getRemoteUrl(tile);
  let response: Response;
  try {
    response = await fetch(url, { signal: options.signal, headers, cache: "no-store" });
  } catch (error) {
    if (isAbortError(error)) throw error;
    logger.debug("Tile network error", tile, error);
    throw new TileUnavailableError("network");
  }
  if (response.status === 304 && options.allowNotModified) {
    return {
      status: 304,
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
    };
  }
  if (response.status === 412 && (options.etag || options.lastModified))
    return fetchTile(source, tile, { signal: options.signal, allowNotModified: false });
  if (response.status !== 200) throw new TileUnavailableError("http");
  const contentType = contentTypeOf(response);
  if (!validContentType(contentType, source))
    throw new TileValidationError("Invalid tile content type");
  const data = await response.arrayBuffer();
  validateLength(response, data);
  return {
    status: 200,
    data,
    contentType,
    etag: response.headers.get("etag") ?? undefined,
    lastModified: response.headers.get("last-modified") ?? undefined,
  };
}
