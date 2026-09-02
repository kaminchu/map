import maplibregl, { type Map } from "maplibre-gl";
import { addLocationLayers } from "./locationLayers";
import { registerTileProtocol } from "./protocol";
import { STD_TILE_SOURCE } from "./tileSources";
import type { CameraState } from "../stores/mapStore";

export interface CreateMapOptions {
  container: HTMLElement;
  camera: CameraState;
  onMoveEnd: (camera: CameraState) => void;
  onUserMove: () => void;
}

export function createMap({ container, camera, onMoveEnd, onUserMove }: CreateMapOptions): Map {
  registerTileProtocol();
  const map = new maplibregl.Map({
    container,
    center: [camera.longitude, camera.latitude],
    zoom: camera.zoom,
    bearing: camera.bearing,
    pitch: camera.pitch,
    attributionControl: { compact: false },
    style: {
      version: 8,
      sources: {
        gsi: {
          type: "raster",
          tiles: ["opfs-gsi://std/{z}/{x}/{y}"],
          tileSize: 256,
          minzoom: STD_TILE_SOURCE.minZoom,
          maxzoom: STD_TILE_SOURCE.maxZoom,
          attribution: STD_TILE_SOURCE.attribution,
        },
      },
      layers: [{ id: "gsi-raster", type: "raster", source: "gsi" }],
    },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  const moveEnd = () =>
    onMoveEnd({
      longitude: map.getCenter().lng,
      latitude: map.getCenter().lat,
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    });
  map.on("moveend", moveEnd);
  map.on("movestart", (event) => {
    if (event.originalEvent && !map.isZooming()) onUserMove();
  });
  map.once("load", () => addLocationLayers(map));
  return map;
}
