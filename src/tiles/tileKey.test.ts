import { describe, expect, it } from "vitest";
import { createTileKey, parseTileKey } from "./tileKey";

describe("tile keys", () => {
  it("round trips a coordinate", () => {
    const tile = { source: "std" as const, z: 15, x: 29091, y: 12903 };
    expect(parseTileKey(createTileKey(tile))).toEqual(tile);
  });
  it.each(["../std/1/0/0", "std/-1/0/0", "std/1/2/0", "std/1/0/2", "pale/1/0/0", "std/1.5/0/0"])(
    "rejects unsafe or invalid key %s",
    (key) => {
      expect(() => parseTileKey(key)).toThrow();
    },
  );
});
