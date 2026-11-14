import type { Map, GeoJSONSource, LayerSpecification } from "maplibre-gl";
import type { MapLayerConfig, LayerContext, LayerState, GeoJSONData } from "../types/map.types";
import { isISODate } from "./geo-utils";

const EMPTY: GeoJSONData = { type: "FeatureCollection", features: [] };
export function layerUnavailable(layer: MapLayerConfig, context: LayerContext): string | null {
  if (!isISODate(context.date)) return "Дата должна иметь формат YYYY-MM-DD.";
  if (layer.supportedModes && !layer.supportedModes.includes(context.mode)) return "Слой не поддерживает эту проекцию.";
  const a = layer.availability;
  if (a && ((a.start && context.date < a.start) || (a.end && context.date > a.end) ||
    (a.dates && !a.dates.includes(context.date)) || (a.isAvailable && !a.isAvailable(context)))) {
    return "Нет данных на выбранную дату.";
  }
  return null;
}
export function rasterTiles(layer: Extract<MapLayerConfig, { type: "raster" }>, context: LayerContext): string[] {
  const tiles = typeof layer.tiles === "function" ? layer.tiles(context) : layer.tiles;
  return tiles.map(url => url.replaceAll("{date}", context.date));
}
interface RecordEntry {
  config: MapLayerConfig; context: LayerContext; key: string;
  abort: AbortController; state: LayerState; paint: Record<string, unknown>; pendingData: boolean;
}
/** One controller per mounted map, with incremental sources and abortable fetches. */
export class LayerController {
  private records = new globalThis.Map<string, RecordEntry>();
  private extra: LayerState[] = [];
  private previousStates = "";
  private disposed = false;
  constructor(private map: Map, private onStates: (states: LayerState[]) => void) {
    map.on("sourcedata", this.sourceLoaded);
    map.on("error", this.sourceError);
  }
  private sourceLoaded = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (!event.sourceId || !event.isSourceLoaded) return;
    for (const [id, entry] of this.records) {
      if (this.sourceId(id) === event.sourceId && entry.state.status === "loading" && !entry.pendingData) {
        entry.state = { id, status: "ready" };
        this.publish();
      }
    }
  };
  private sourceError = (event: { sourceId?: string; error?: { message: string } }) => {
    if (!event.sourceId) return;
    for (const [id, entry] of this.records) {
      if (this.sourceId(id) === event.sourceId) {
        entry.state = { id, status: "error", message: event.error?.message ?? "Не удалось загрузить тайлы." };
        this.publish();
      }
    }
  };
  private sourceId(id: string) { return "earth-overlay-" + id; }
  private renderId(id: string) { return this.sourceId(id) + "-render"; }
  private publish() {
    if (this.disposed) return;
    const states = [...this.records.values()].map(e => e.state).concat(this.extra);
    const signature = JSON.stringify(states);
    if (signature !== this.previousStates) { this.previousStates = signature; this.onStates(states); }
  }
  private remove(id: string) {
    const entry = this.records.get(id);
    entry?.abort.abort();
    if (this.map.getLayer(this.renderId(id))) this.map.removeLayer(this.renderId(id));
    if (this.map.getSource(this.sourceId(id))) this.map.removeSource(this.sourceId(id));
    this.records.delete(id);
  }
  sync(layers: readonly MapLayerConfig[], context: LayerContext, limit = 6) {
    if (this.disposed) return;
    const wanted = new Set<string>();
    this.extra = [];
    let count = 0;
    for (const layer of layers) {
      if (layer.enabled === false) continue;
      if (!/^[a-zA-Z0-9_-]+$/.test(layer.id) || wanted.has(layer.id)) {
        this.extra.push({ id: layer.id, status: "error", message: "ID слоя должен быть уникальным: латиница, цифры, _ и -." });
        continue;
      }
      wanted.add(layer.id);
      try {
        const unavailable = layerUnavailable(layer, context);
        if (unavailable) {
          this.remove(layer.id);
          this.extra.push({ id: layer.id, status: "unavailable", message: unavailable });
          continue;
        }
        if (++count > Math.max(1, Math.min(limit, 12))) {
          this.remove(layer.id);
          this.extra.push({ id: layer.id, status: "limited", message: "Достигнут лимит активных слоёв." });
          continue;
        }
        this.upsert(layer, context);
      } catch (e) {
        this.remove(layer.id);
        this.extra.push({ id: layer.id, status: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }
    for (const id of this.records.keys()) if (!wanted.has(id)) this.remove(id);
    this.publish();
  }
  private upsert(config: MapLayerConfig, context: LayerContext) {
    const source = this.sourceId(config.id), id = this.renderId(config.id);
    const type = config.type === "raster" ? "raster" : config.renderAs ??
      (config.type === "points" ? "circle" : config.type === "heatmap" ? "heatmap" : "fill");
    const key = config.type === "raster" ? JSON.stringify({
      type, tiles: rasterTiles(config, context), tileSize: config.tileSize ?? 256,
      maxzoom: config.maxzoom ?? 12, minzoom: config.minzoom ?? 0, scheme: config.scheme ?? "xyz", bounds: config.bounds,
      attribution: config.attribution,
    }) : type + "|" + (config.attribution ?? "");
    let entry = this.records.get(config.id);
    if (entry && entry.key !== key) { this.remove(config.id); entry = undefined; }
    const isNew = !entry;
    if (!entry) {
      entry = { config, context, key, abort: new AbortController(), state: { id: config.id, status: "loading" }, paint: {}, pendingData: false };
      this.records.set(config.id, entry);
      if (config.type === "raster") {
        this.map.addSource(source, { type: "raster", tiles: rasterTiles(config, context),
          tileSize: config.tileSize ?? 256, minzoom: config.minzoom ?? 0, maxzoom: config.maxzoom ?? 12,
          scheme: config.scheme ?? "xyz", bounds: config.bounds, attribution: config.attribution });
      } else {
        this.map.addSource(source, { type: "geojson", data: EMPTY, attribution: config.attribution });
      }
      // Insertion below labels keeps geographic names legible.
      const before = this.map.getLayer("earth-labels") ? "earth-labels" : undefined;
      this.map.addLayer({ id, type, source } as LayerSpecification, before);
    }
    const opacity = Math.max(0, Math.min(1, config.opacity ?? 0.65));
    const color = config.color ?? "#b9e887";
    const defaults: Record<string, unknown> = type === "raster" ? { "raster-opacity": opacity } :
      type === "circle" ? { "circle-radius": 5, "circle-color": color, "circle-stroke-color": "#fff", "circle-stroke-width": 1.2, "circle-opacity": opacity, "circle-stroke-opacity": opacity } :
      type === "line" ? { "line-color": color, "line-width": 2, "line-opacity": opacity } :
      type === "heatmap" ? { "heatmap-radius": 36, "heatmap-intensity": 1, "heatmap-opacity": opacity,
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.3, "#415eab", 0.6, "#8bb5fa", 1, "#e5f0ff"] } :
      { "fill-color": color, "fill-opacity": opacity, "fill-outline-color": color };
    const paint: Record<string, unknown> = { ...defaults, ...(config.type !== "raster" ? config.paint : {}) };
    // The dedicated opacity prop always remains authoritative.
    paint[type + "-opacity"] = opacity;
    for (const name of Object.keys(entry.paint)) if (!(name in paint)) this.map.setPaintProperty(id, name as Parameters<Map["setPaintProperty"]>[1], undefined);
    for (const [name, value] of Object.entries(paint)) {
      if (JSON.stringify(entry.paint[name]) !== JSON.stringify(value)) this.map.setPaintProperty(id, name as Parameters<Map["setPaintProperty"]>[1], value as Parameters<Map["setPaintProperty"]>[2]);
    }
    entry.paint = paint;
    if (config.type !== "raster") {
      const prev = entry.config;
      const changed = isNew || prev.type === "raster" || config.data !== prev.data || config.revision !== prev.revision ||
        ((typeof config.data === "function" || (typeof config.data === "string" && config.data.includes("{date}"))) && (entry.context.date !== context.date || entry.context.mode !== context.mode));
      if (changed) {
        entry.abort.abort();
        entry.abort = new AbortController();
        const signal = entry.abort.signal;
        entry.pendingData = true;
        entry.state = { id: config.id, status: "loading" };
        // Clear the previous date immediately, so it cannot masquerade as current data.
        (this.map.getSource(source) as GeoJSONSource).setData(EMPTY);
        const data = config.data;
        const load = typeof data === "function" ? () => data(context, signal) :
          typeof data === "string" ? async () => {
            const response = await fetch(data.replaceAll("{date}", context.date), { signal });
            if (!response.ok) throw new Error("GeoJSON HTTP " + response.status);
            return await response.json() as GeoJSONData;
          } : async () => data;
        void load().then(result => {
          if (this.disposed || signal.aborted) return;
          if (!result || !["Feature", "FeatureCollection"].includes(result.type)) throw new Error("Ожидается GeoJSON Feature или FeatureCollection.");
          entry.pendingData = false;
          (this.map.getSource(source) as GeoJSONSource).setData(result);
        }).catch((e: unknown) => {
          if (this.disposed || signal.aborted) return;
          entry.pendingData = false;
          entry.state = { id: config.id, status: "error", message: e instanceof Error ? e.message : String(e) };
          this.publish();
        });
      }
    }
    entry.config = config;
    entry.context = { ...context };
  }
  dispose() {
    this.disposed = true;
    this.map.off("sourcedata", this.sourceLoaded);
    this.map.off("error", this.sourceError);
    for (const id of this.records.keys()) this.remove(id);
  }
}
