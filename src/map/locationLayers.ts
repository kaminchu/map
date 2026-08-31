import { GeoJSONSource, type Map } from "maplibre-gl";
import { accuracyCircle } from "../tiles/tileMath";

const sourceId = "current-location";

function emptyData(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

export function addLocationLayers(map: Map): void {
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, { type: "geojson", data: emptyData() });
  map.addLayer({
    id: "current-location-accuracy",
    type: "fill",
    source: sourceId,
    paint: { "fill-color": "#2563eb", "fill-opacity": 0.16, "fill-outline-color": "#2563eb" },
  });
  map.addLayer({
    id: "current-location-heading",
    type: "line",
    source: sourceId,
    filter: ["==", ["get", "kind"], "heading"],
    paint: { "line-color": "#1d4ed8", "line-width": 4, "line-opacity": 0.9 },
  });
  map.addLayer({
    id: "current-location-point",
    type: "circle",
    source: sourceId,
    filter: ["==", ["get", "kind"], "point"],
    paint: {
      "circle-radius": 7,
      "circle-color": "#2563eb",
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
  });
}

export function updateLocationLayers(
  map: Map,
  location: { longitude?: number; latitude?: number; accuracy?: number; heading?: number },
): void {
  const source = map.getSource(sourceId);
  if (
    !(source instanceof GeoJSONSource) ||
    location.longitude === undefined ||
    location.latitude === undefined
  )
    return;
  const point: GeoJSON.Feature<GeoJSON.Point> = {
    type: "Feature",
    properties: { kind: "point" },
    geometry: { type: "Point", coordinates: [location.longitude, location.latitude] },
  };
  const circle: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: "Feature",
    properties: { kind: "accuracy" },
    geometry: {
      type: "Polygon",
      coordinates: [accuracyCircle(location.longitude, location.latitude, location.accuracy ?? 0)],
    },
  };
  const features: GeoJSON.Feature[] = [circle, point];
  if (location.heading !== undefined && Number.isFinite(location.heading)) {
    const distance = Math.max(20, location.accuracy ?? 20) * 2;
    const end = [
      location.longitude +
        (distance * Math.sin((location.heading * Math.PI) / 180)) /
          (111_320 * Math.max(0.1, Math.cos((location.latitude * Math.PI) / 180))),
      location.latitude + (distance * Math.cos((location.heading * Math.PI) / 180)) / 111_320,
    ];
    features.push({
      type: "Feature",
      properties: { kind: "heading" },
      geometry: { type: "LineString", coordinates: [[location.longitude, location.latitude], end] },
    });
  }
  source.setData({ type: "FeatureCollection", features });
}
