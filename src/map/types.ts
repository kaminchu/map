import type { Map } from "maplibre-gl";

export interface MapInstanceHandle {
  map: Map;
  destroy: () => void;
}
