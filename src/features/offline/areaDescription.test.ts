import { describe, expect, it, vi } from "vitest";
import { centerOfBounds, describeArea, municipalityAtCenter } from "./areaDescription";

const deserialize = vi.hoisted(() => vi.fn());

vi.mock("flatgeobuf", () => ({ geojson: { deserialize } }));

describe("area description", () => {
  it("uses the municipality and approximate dimensions", () => {
    expect(describeArea({ west: 139, south: 35, east: 140, north: 36 }, "東京都新宿区")).toBe(
      "東京都新宿区付近（縦 約111 km × 横 約91 km）",
    );
  });

  it("finds the center of bounds crossing the antimeridian", () => {
    expect(centerOfBounds({ west: 170, south: -10, east: -170, north: 10 })).toEqual([-180, 0]);
  });

  it("gets the municipality containing the center from FlatGeobuf", async () => {
    deserialize.mockReturnValue(
      (async function* () {
        yield {
          type: "Feature",
          properties: { N03_001: "北海道", N03_004: "札幌市", N03_005: "中央区" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [140, 34],
                [141, 34],
                [141, 36],
                [140, 36],
                [140, 34],
              ],
            ],
          },
        };
        yield {
          type: "Feature",
          properties: { N03_001: "東京都", N03_004: "新宿区" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [139, 35],
                [140, 35],
                [140, 36],
                [139, 36],
                [139, 35],
              ],
            ],
          },
        };
      })(),
    );

    await expect(
      municipalityAtCenter({ west: 139, south: 35, east: 140, north: 36 }),
    ).resolves.toBe("東京都新宿区");
    expect(deserialize).toHaveBeenCalledWith(expect.stringContaining("N03-20260101.fgb"), {
      minX: 139.5,
      minY: 35.5,
      maxX: 139.5,
      maxY: 35.5,
    });
  });
});
