import { describe, expect, it, vi } from "vitest";
import { TileValidationError, TileUnavailableError } from "../lib/errors";
import { STD_TILE_SOURCE } from "../map/tileSources";
import { fetchTile } from "./tileFetcher";

const tile = { source: "std" as const, z: 1, x: 0, y: 0 };

describe("tile fetcher", () => {
  it("accepts a PNG body and metadata headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2]), {
        status: 200,
        headers: { "content-type": "image/png", "content-length": "2", etag: "v1" },
      }),
    );
    await expect(fetchTile(STD_TILE_SOURCE, tile)).resolves.toMatchObject({
      status: 200,
      etag: "v1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cyberjapandata.gsi.go.jp/xyz/std/1/0/0.png",
      expect.objectContaining({ cache: "no-store" }),
    );
    fetchMock.mockRestore();
  });
  it("rejects HTML, empty and mismatched bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("error", { status: 200, headers: { "content-type": "text/html" } }),
    );
    await expect(fetchTile(STD_TILE_SOURCE, tile)).rejects.toBeInstanceOf(TileValidationError);
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(new Uint8Array([]), { status: 200, headers: { "content-type": "image/png" } }),
    );
    await expect(fetchTile(STD_TILE_SOURCE, tile)).rejects.toBeInstanceOf(TileValidationError);
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "content-type": "image/png", "content-length": "2" },
      }),
    );
    await expect(fetchTile(STD_TILE_SOURCE, tile)).rejects.toBeInstanceOf(TileValidationError);
    vi.restoreAllMocks();
  });
  it("retries a conditional 412 without validators", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 412 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      );
    await expect(
      fetchTile(STD_TILE_SOURCE, tile, { etag: "v1", allowNotModified: true }),
    ).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ headers: {} }),
    );
    vi.restoreAllMocks();
  });
  it("classifies non-abort network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    await expect(fetchTile(STD_TILE_SOURCE, tile)).rejects.toBeInstanceOf(TileUnavailableError);
    vi.restoreAllMocks();
  });
});
