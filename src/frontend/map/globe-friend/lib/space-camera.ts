import type { CameraState } from "../types/map.types";

const RADIANS = Math.PI / 180;
/** Camera-to-world basis, column-major. Continuous across ±180° and the poles. */
export function spaceRotation(camera: CameraState, roll = 0): Float32Array {
  const lng = camera.center.lng * RADIANS, lat = camera.center.lat * RADIANS;
  const bearing = camera.bearing * RADIANS, pitch = camera.pitch * RADIANS;
  const east = [-Math.sin(lng), 0, -Math.cos(lng)];
  const north = [-Math.sin(lat) * Math.cos(lng), Math.cos(lat), Math.sin(lat) * Math.sin(lng)];
  const normal = [Math.cos(lat) * Math.cos(lng), Math.sin(lat), -Math.cos(lat) * Math.sin(lng)];
  const right = east.map((value, i) => value * Math.cos(bearing) - north[i] * Math.sin(bearing));
  const up = east.map((value, i) => value * Math.sin(bearing) + north[i] * Math.cos(bearing));
  const tiltedUp = up.map((value, i) => value * Math.cos(pitch) + normal[i] * Math.sin(pitch));
  const back = normal.map((value, i) => value * Math.cos(pitch) - up[i] * Math.sin(pitch));
  const r = roll * RADIANS;
  const rolledRight = right.map((value, i) => value * Math.cos(r) - tiltedUp[i] * Math.sin(r));
  const rolledUp = right.map((value, i) => value * Math.sin(r) + tiltedUp[i] * Math.cos(r));
  return new Float32Array([...rolledRight, ...rolledUp, ...back]);
}
/** Bound fill rate and memory independently of the display's pixel density. */
export function spaceCanvasSize(width: number, height: number, dpr: number): [number, number] {
  const scale = Math.min(Math.max(dpr, 0.5), 1.25, Math.sqrt(900_000 / Math.max(width * height, 1)));
  return [Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale))];
}
export function spaceVisibility(zoom: number): number {
  const t = Math.min(1, Math.max(0, (zoom - 2.5) / 3));
  return 1 - t * t * (3 - 2 * t);
}
