import maplibregl from "maplibre-gl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMap } from "./createMap";
import { STD_TILE_SOURCE } from "./tileSources";

const map = {
  addControl: vi.fn(),
  getBearing: vi.fn(() => 0),
  getCenter: vi.fn(() => ({ lng: 139.7, lat: 35.7 })),
  getPitch: vi.fn(() => 0),
  getZoom: vi.fn(() => 10),
  on: vi.fn(),
  once: vi.fn(),
};

vi.mock("maplibre-gl", () => ({
  default: {
    addProtocol: vi.fn(),
    Map: vi.fn(function MockMap() {
      return map;
    }),
    NavigationControl: vi.fn(function MockNavigationControl() {}),
  },
}));

vi.mock("./locationLayers", () => ({ addLocationLayers: vi.fn() }));
vi.mock("./protocol", () => ({ registerTileProtocol: vi.fn() }));

describe("createMap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("always displays the tile source attribution", () => {
    const container = document.createElement("div");

    createMap({
      container,
      camera: { longitude: 139.7, latitude: 35.7, zoom: 10, bearing: 0, pitch: 0 },
      onMoveEnd: vi.fn(),
      onUserMove: vi.fn(),
    });

    expect(maplibregl.Map).toHaveBeenCalledWith(
      expect.objectContaining({
        attributionControl: { compact: false },
        style: expect.objectContaining({
          sources: expect.objectContaining({
            gsi: expect.objectContaining({ attribution: STD_TILE_SOURCE.attribution }),
          }),
        }),
      }),
    );
    expect(STD_TILE_SOURCE.attribution).toContain("地図出典:");
  });

  it("places zoom controls away from the bottom navigation", () => {
    const container = document.createElement("div");

    createMap({
      container,
      camera: { longitude: 139.7, latitude: 35.7, zoom: 10, bearing: 0, pitch: 0 },
      onMoveEnd: vi.fn(),
      onUserMove: vi.fn(),
    });

    expect(map.addControl).toHaveBeenCalledWith(expect.anything(), "top-right");
  });

  it("reports only map movement caused by user input", () => {
    const onUserMove = vi.fn();

    createMap({
      container: document.createElement("div"),
      camera: { longitude: 139.7, latitude: 35.7, zoom: 10, bearing: 0, pitch: 0 },
      onMoveEnd: vi.fn(),
      onUserMove,
    });

    const moveStart = map.on.mock.calls.find(([event]) => event === "movestart")?.[1];
    if (!moveStart) throw new Error("movestart handler was not registered");
    moveStart({ originalEvent: undefined });
    expect(onUserMove).not.toHaveBeenCalled();

    moveStart({ originalEvent: new MouseEvent("mousedown") });
    expect(onUserMove).toHaveBeenCalledOnce();
  });
});
