import maplibregl, { type AddProtocolAction } from "maplibre-gl";
import { TileUnavailableError } from "../lib/errors";
import { tileRepository } from "../tiles/tileRepositoryImpl";
import { createTileKey } from "../tiles/tileKey";
import type { TileRequest } from "../tiles/types";

let registered = false;

function parseProtocolUrl(url: string): TileRequest {
  const parsed = new URL(url);
  if (parsed.protocol !== "opfs-gsi:" || parsed.hostname !== "std")
    throw new Error("Invalid tile protocol URL");
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length !== 3) throw new Error("Invalid tile protocol path");
  const zText = parts[0];
  const xText = parts[1];
  const yText = parts[2];
  if (zText === undefined || xText === undefined || yText === undefined)
    throw new Error("Invalid tile protocol path");
  const z = Number(zText);
  const x = Number(xText);
  const y = Number(yText);
  const request = {
    source: "std" as const,
    z,
    x,
    y,
    priority: "visible" as const,
  } satisfies TileRequest;
  createTileKey(request);
  return request;
}

const handler: AddProtocolAction = async (params, abortController) => {
  try {
    const request = parseProtocolUrl(params.url);
    const tile = await tileRepository.getTile({ ...request, signal: abortController.signal });
    return { data: tile.data };
  } catch (error) {
    if (error instanceof TileUnavailableError) throw error;
    throw error;
  }
};

export function registerTileProtocol(): void {
  if (registered) return;
  maplibregl.addProtocol("opfs-gsi", handler);
  registered = true;
}
