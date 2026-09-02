import { describe, expect, it, vi } from "vitest";
import { addLocationLayers } from "./locationLayers";

describe("addLocationLayers", () => {
  it("uses a fixed-size, current-location-colored symbol for the heading", () => {
    const map = {
      getSource: vi.fn(),
      addSource: vi.fn(),
      hasImage: vi.fn(() => false),
      addImage: vi.fn(),
      addLayer: vi.fn(),
    };

    addLocationLayers(map as never);

    expect(map.addImage).toHaveBeenCalledWith(
      "current-location-heading-image",
      expect.objectContaining({ width: 96, height: 96 }),
      { pixelRatio: 2 },
    );
    const image = map.addImage.mock.calls[0]?.[1] as { data: Uint8Array };
    const alphaAt = (x: number, y: number) => image.data[(y * 96 + x) * 4 + 3] ?? 0;
    expect(alphaAt(23, 8)).toBe(0);
    expect(alphaAt(24, 8)).toBe(32);
    expect(alphaAt(48, 8)).toBeLessThan(alphaAt(48, 54));
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "current-location-heading",
        type: "symbol",
        layout: expect.objectContaining({
          "icon-image": "current-location-heading-image",
          "icon-size": 1,
          "icon-rotate": ["get", "heading"],
        }),
      }),
    );
  });
});
