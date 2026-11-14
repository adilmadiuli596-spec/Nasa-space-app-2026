import type { Map } from "maplibre-gl";
import type { FeatureCollection, Polygon } from "geojson";
import type { MapPoint, RegionBounds } from "../types/map.types";

export function normalizeLongitude(lng: number): number {
  return ((lng + 180) % 360 + 360) % 360 - 180;
}
export function normalizePoint(point: MapPoint): MapPoint {
  return { lng: normalizeLongitude(point.lng), lat: Math.max(-90, Math.min(90, point.lat)) };
}
export function isValidPoint(point: MapPoint): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90;
}
/** Select the shorter longitude interval, including when it crosses ±180°. */
export function boundsFromPoints(a: MapPoint, b: MapPoint): RegionBounds {
  const x = normalizeLongitude(a.lng), y = normalizeLongitude(b.lng);
  const crossesAntimeridian = Math.abs(x - y) > 180;
  const west = crossesAntimeridian ? Math.max(x, y) : Math.min(x, y);
  const east = crossesAntimeridian ? Math.min(x, y) : Math.max(x, y);
  const south = Math.max(-90, Math.min(a.lat, b.lat));
  const north = Math.min(90, Math.max(a.lat, b.lat));
  return { west, south, east, north, crossesAntimeridian, bbox: [west, south, east, north] };
}
export function regionToGeoJSON(bounds: RegionBounds | null): FeatureCollection<Polygon> {
  if (!bounds) return { type: "FeatureCollection", features: [] };
  const { west, south, east, north } = bounds;
  const boxes = west > east ? [[west, 180], [-180, east]] : [[west, east]];
  return { type: "FeatureCollection", features: boxes.map(([w, e]) => ({
    type: "Feature", properties: {},
    geometry: { type: "Polygon", coordinates: [[[w,south],[e,south],[e,north],[w,north],[w,south]]] },
  })) };
}
export function formatCoordinate(point: MapPoint): string {
  return Math.abs(point.lat).toFixed(3) + "° " + (point.lat >= 0 ? "N" : "S") + "  ·  " +
    Math.abs(point.lng).toFixed(3) + "° " + (point.lng >= 0 ? "E" : "W");
}
export function isISODate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}

/** Reject sky clicks by round-tripping the public projection API. */
export function isMapSurface(map: Map, point: { x: number; y: number }): boolean {
  const geographic = map.unproject([point.x, point.y]);
  if (!Number.isFinite(geographic.lat) || !Number.isFinite(geographic.lng)) return false;
  const screen = map.project(geographic);
  return Math.hypot(screen.x - point.x, screen.y - point.y) < 2;
}
