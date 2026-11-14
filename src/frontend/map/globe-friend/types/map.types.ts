import type { CSSProperties, Ref } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { FlyToOptions, Map, StyleSpecification, CircleLayerSpecification, FillLayerSpecification, LineLayerSpecification, HeatmapLayerSpecification } from "maplibre-gl";

export type MapMode = "globe" | "mercator";
export type MapBasemap = "satellite" | "map";
export interface MapPoint { lat: number; lng: number }
/** WGS84 degrees. west > east means that the box crosses the antimeridian. */
export interface RegionBounds {
  west: number; south: number; east: number; north: number;
  crossesAntimeridian: boolean;
  bbox: [west: number, south: number, east: number, north: number];
}
export type GeoJSONData = FeatureCollection | Feature<Geometry>;
export interface GeocodingResult {
  id: string; name: string; description?: string; point: MapPoint; zoom?: number;
}
export interface GeocodingAdapter {
  label: string;
  search(query: string, signal: AbortSignal): Promise<GeocodingResult[]>;
}
export interface LayerContext { date: string; mode: MapMode }
export type LayerStatus = "loading" | "ready" | "unavailable" | "error" | "limited";
export interface LayerState { id: string; status: LayerStatus; message?: string }
export interface LayerAvailability {
  start?: string; end?: string; dates?: readonly string[];
  /** Supplied by the host from product metadata, including temporal gaps. */
  isAvailable?: (context: LayerContext) => boolean;
}
interface BaseLayer {
  id: string; title: string; description?: string; category?: string;
  enabled?: boolean; opacity?: number; color?: string; demo?: boolean;
  attribution?: string;
  supportedModes?: readonly MapMode[];
  availability?: LayerAvailability;
  legend?: { min: string; max: string; colors: readonly string[]; unit?: string };
}
export interface RasterMapLayer extends BaseLayer {
  type: "raster";
  /** Standard Web Mercator XYZ URLs; use {date}, {z}, {x}, {y}. */
  tiles: readonly string[] | ((context: LayerContext) => readonly string[]);
  tileSize?: 256 | 512; minzoom?: number; maxzoom?: number;
  scheme?: "xyz" | "tms"; bounds?: [number, number, number, number];
}
export interface GeoJSONMapLayer extends BaseLayer {
  type: "geojson" | "polygon" | "heatmap" | "points";
  data: GeoJSONData | string | ((context: LayerContext, signal: AbortSignal) => Promise<GeoJSONData>);
  /** Bump when a stable resolver should refetch data. */
  revision?: string | number;
  renderAs?: "fill" | "line" | "circle" | "heatmap";
  paint?: FillLayerSpecification["paint"] | LineLayerSpecification["paint"] | CircleLayerSpecification["paint"] | HeatmapLayerSpecification["paint"];
}
export type MapLayerConfig = RasterMapLayer | GeoJSONMapLayer;
export interface MapMarkerData { id: string; point: MapPoint; label?: string; color?: string }
export interface CameraState { center: MapPoint; zoom: number; bearing: number; pitch: number }
export interface EarthMapHandle {
  flyTo(point: MapPoint, options?: Omit<FlyToOptions, "center">): void;
  resetView(): void; zoomIn(): void; zoomOut(): void;
  clearSelection(): void; resize(): void;
  getCamera(): CameraState | null;
  /** Escape hatch: do not remove the map or mutate earth-* sources. */
  getMap(): Map | null;
}
export interface EarthMapProps {
  ref?: Ref<EarthMapHandle>;
  mode?: MapMode; defaultMode?: MapMode; onModeChange?: (mode: MapMode) => void;
  /** Built-in basemap, independent of the globe / Mercator projection. */
  basemap?: MapBasemap; defaultBasemap?: MapBasemap;
  onBasemapChange?: (basemap: MapBasemap) => void;
  selectedDate: string;
  activeLayers?: readonly MapLayerConfig[];
  onLayersChange?: (layers: MapLayerConfig[]) => void;
  selectedLocation?: MapPoint | null;
  selectedRegion?: RegionBounds | null;
  onLocationSelect?: (point: MapPoint | null) => void;
  onRegionSelect?: (bounds: RegionBounds | null) => void;
  markers?: readonly MapMarkerData[];
  geocoder?: GeocodingAdapter;
  initialView?: Partial<CameraState>;
  /** Read once at mount. Remount to replace the entire base style. */
  baseStyle?: StyleSpecification | string;
  maxActiveLayers?: number;
  /** Decorative all-sky panorama, rendered only in globe mode. */
  showSpaceBackground?: boolean;
  showSearch?: boolean; showLayerManager?: boolean; showControls?: boolean;
  className?: string; style?: CSSProperties;
  onReady?: (map: Map) => void;
  onCameraChange?: (camera: CameraState) => void;
  onLayerStatusChange?: (states: LayerState[]) => void;
  onError?: (error: Error) => void;
}
