import { GeoJSONSource, type Map } from "maplibre-gl";
import { accuracyCircle } from "../tiles/tileMath";

const sourceId = "current-location";
const headingImageId = "current-location-heading-image";
const headingImageSize = 96;

function headingImage(): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(headingImageSize * headingImageSize * 4);
  const top = 8;
  const apex = 54;
  const center = headingImageSize / 2;
  const maxHalfWidth = 24;
  const outerRadius = Math.hypot(maxHalfWidth, apex - top);
  for (let y = Math.floor(apex - outerRadius); y <= apex; y += 1) {
    const distanceFromApex = apex - y;
    const halfWidth = (distanceFromApex * maxHalfWidth) / (apex - top);
    for (let x = Math.ceil(center - halfWidth); x <= Math.floor(center + halfWidth); x += 1) {
      const distance = Math.hypot(x - center, distanceFromApex);
      if (distance > outerRadius) continue;
      const offset = (y * headingImageSize + x) * 4;
      data[offset] = 37;
      data[offset + 1] = 99;
      data[offset + 2] = 235;
      data[offset + 3] = Math.round(32 + 64 * (1 - distance / outerRadius));
    }
  }
  return { width: headingImageSize, height: headingImageSize, data };
}

function emptyData(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

export function addLocationLayers(map: Map): void {
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, { type: "geojson", data: emptyData() });
  if (!map.hasImage(headingImageId)) {
    map.addImage(headingImageId, headingImage(), { pixelRatio: 2 });
  }
  map.addLayer({
    id: "current-location-accuracy",
    type: "fill",
    source: sourceId,
    filter: ["==", ["get", "kind"], "accuracy"],
    paint: { "fill-color": "#2563eb", "fill-opacity": 0.16, "fill-outline-color": "#2563eb" },
  });
  map.addLayer({
    id: "current-location-heading",
    type: "symbol",
    source: sourceId,
    filter: ["==", ["get", "kind"], "heading"],
    layout: {
      "icon-image": headingImageId,
      "icon-size": 1,
      "icon-rotate": ["get", "heading"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
    },
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
    features.push({
      type: "Feature",
      properties: { kind: "heading", heading: location.heading },
      geometry: { type: "Point", coordinates: [location.longitude, location.latitude] },
    });
  }
  source.setData({ type: "FeatureCollection", features });
}
