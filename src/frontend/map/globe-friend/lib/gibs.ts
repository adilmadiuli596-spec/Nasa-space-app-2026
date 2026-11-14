import type { LayerAvailability, RasterMapLayer } from "../types/map.types";

export interface GIBSLayerOptions {
  id: string; title: string; product: string;
  /** Use EPSG:3857 GoogleMapsCompatible matrix metadata from GetCapabilities. */
  matrixSet: string; maxzoom: number;
  format: "png" | "jpg"; tileSize: 256 | 512;
  availability: LayerAvailability;
  timeDependent?: boolean;
  service?: "best" | "std" | "nrt";
  opacity?: number; enabled?: boolean;
}
export function createGIBSLayer(options: GIBSLayerOptions): RasterMapLayer {
  if (!/^GoogleMapsCompatible_Level\d+$/.test(options.matrixSet)) {
    throw new Error("GIBS: требуется сетка GoogleMapsCompatible для EPSG:3857.");
  }
  const level = Number(options.matrixSet.match(/\d+$/)?.[0]);
  if (!Number.isInteger(options.maxzoom) || options.maxzoom < 0 || options.maxzoom > level) {
    throw new Error("GIBS: maxzoom должен соответствовать TileMatrixSet.");
  }
  if (!options.availability.start && !options.availability.dates && !options.availability.isAvailable) {
    throw new Error("GIBS: укажите подтверждённую доступность продукта.");
  }
  return {
    id: options.id, title: options.title, type: "raster", category: "NASA GIBS",
    tiles: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/" + (options.service ?? "best") + "/" +
      encodeURIComponent(options.product) + "/default/" + (options.timeDependent === false ? "default" : "{date}") +
      "/" + options.matrixSet + "/{z}/{y}/{x}." + options.format],
    tileSize: options.tileSize, maxzoom: options.maxzoom, availability: options.availability,
    opacity: options.opacity ?? 0.7, enabled: options.enabled ?? true,
    attribution: '<a href="https://earthdata.nasa.gov/gibs">NASA EOSDIS GIBS</a>',
    supportedModes: ["globe", "mercator"],
    description: "Визуализация NASA GIBS. Прозрачный тайл не подтверждает наличие наблюдений.",
  };
}
