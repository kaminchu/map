import { describe, expect, it } from "vitest";
import { countTilesForBounds, enumerateTilesForBounds, tileFromLngLat } from "./tileMath";

describe("tile math", () => {
  it("calculates Tokyo tile coordinates", () => {
    expect(tileFromLngLat({ longitude: 139.767, latitude: 35.681 }, 10)).toEqual({
      source: "std",
      z: 10,
      x: 909,
      y: 403,
    });
  });
  it("clamps mercator limits and coordinates", () => {
    expect(tileFromLngLat({ longitude: 180, latitude: 90 }, 2)).toEqual({
      source: "std",
      z: 2,
      x: 3,
      y: 0,
    });
    expect(tileFromLngLat({ longitude: -180, latitude: -90 }, 2)).toEqual({
      source: "std",
      z: 2,
      x: 0,
      y: 3,
    });
  });
  it("enumerates stable, inclusive ranges across the date line", () => {
    const tiles = enumerateTilesForBounds({ west: 179, south: -1, east: -179, north: 1 }, 2, 3);
    expect(tiles.length).toBe(
      countTilesForBounds({ west: 179, south: -1, east: -179, north: 1 }, 2, 3),
    );
    expect(new Set(tiles.map((tile) => `${tile.z}/${tile.x}/${tile.y}`)).size).toBe(tiles.length);
    expect(
      tiles.every(
        (tile) => tile.x >= 0 && tile.x < 2 ** tile.z && tile.y >= 0 && tile.y < 2 ** tile.z,
      ),
    ).toBe(true);
  });
  it("rejects an invalid zoom range", () => {
    expect(() => enumerateTilesForBounds({ west: 0, south: 0, east: 1, north: 1 }, 4, 3)).toThrow();
  });
});
