"use client";
import { useEffect, useRef, useState } from "react";
import type { Map } from "maplibre-gl";
import type { EarthMapProps, CameraState } from "../types/map.types";
import { createBaseStyle, DEFAULT_VIEW } from "../lib/map-config";
import { isEmbeddedPreview, mapPixelRatio } from "../lib/render-performance";
import {addMapAttribution} from '../../map-attribution';
import { normalizePoint } from "../lib/geo-utils";

export function readCamera(map: Map): CameraState {
  const c = map.getCenter();
  return { center: normalizePoint({ lat: c.lat, lng: c.lng }), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
}
export function useEarthMap(container: React.RefObject<HTMLDivElement | null>, props: EarthMapProps) {
  const latest = useRef(props);
  useEffect(() => { latest.current = props; });
  const [map, setMap] = useState<Map | null>(null);
  const [ready, setReady] = useState(false);
  const [basemapLoading, setBasemapLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    let instance: Map | undefined;
    let observer: ResizeObserver | undefined;
    let resizeFrame = 0;
    let canvas: HTMLCanvasElement | undefined;
    const contextLost = (event: Event) => {
      event.preventDefault();
      setError("Контекст WebGL потерян. Ожидаем восстановления…");
      latest.current.onError?.(new Error("3D WebGL context lost"));
    };
    const contextRestored = () => setError(null);
    void import("maplibre-gl").then(({ Map: MapLibreMap, setWorkerUrl, getVersion }) => {
      if (disposed || !container.current) return;
      setWorkerUrl(`/vendor/maplibre-${getVersion()}/maplibre-gl-worker.mjs`);
      const options = latest.current;
      const view = { ...DEFAULT_VIEW, ...options.initialView };
      const embedded = isEmbeddedPreview();
      instance = new MapLibreMap({
        container: container.current,
        style: options.baseStyle ?? createBaseStyle(),
        center: [view.center.lng, view.center.lat], zoom: view.zoom, bearing: view.bearing, pitch: view.pitch,
        minZoom: -0.5, maxZoom: 16,
        canvasContextAttributes: { antialias: !embedded },
        pixelRatio: mapPixelRatio(window.devicePixelRatio, embedded),
        maxCanvasSize: embedded ? [1920, 1200] : [2560, 1600],
        fadeDuration: embedded ? 0 : 150,
        attributionControl:false,locale:{'AttributionControl.ToggleAttribution':'Источники карты'},
        maxTileCacheSize: embedded ? 96 : 160,
      });
      const current = instance;
      addMapAttribution(current);
      canvas = current.getCanvas();
      canvas.addEventListener("webglcontextlost", contextLost);
      canvas.addEventListener("webglcontextrestored", contextRestored);
      canvas.setAttribute("aria-label", "Интерактивная карта Земли. Стрелки — перемещение, плюс и минус — масштаб.");
      let notified = false;
      const styleReady = () => {
        if (disposed || notified) return;
        notified = true;
        // style.load means mutations are safe; load also waits for remote tiles.
        setReady(true);
        latest.current.onReady?.(current);
      };
      current.on("style.load", styleReady);
      current.on("load", styleReady);
      current.on("dataloading", event => {
        const active = (latest.current.basemap ?? latest.current.defaultBasemap ?? "satellite") === "map" ? "streets" : "satellite";
        if (!disposed && "sourceId" in event) setBasemapLoading(true);
      });
      current.on("sourcedata", event => {
        const active = (latest.current.basemap ?? latest.current.defaultBasemap ?? "satellite") === "map" ? "streets" : "satellite";
        if (!disposed && event.isSourceLoaded) setBasemapLoading(false);
      });
      current.on("moveend", () => latest.current.onCameraChange?.(readCamera(current)));
      current.on("error", event => {
        if (disposed) return;
        const message = event.error?.message ?? "Ошибка загрузки карты";
        latest.current.onError?.(new Error(message));
        setBasemapLoading(false);
        // Overlay errors are reported by LayerController with the layer ID.
        if (!("sourceId" in event) || !String(event.sourceId).startsWith("earth-overlay-")) {
          setError("Не удалось загрузить часть подложки. Проверьте подключение к интернету.");
        }
      });
      current.on("idle", () => {
        if (!disposed) setBasemapLoading(false);
        const source = (latest.current.basemap ?? latest.current.defaultBasemap ?? "satellite") === "map" ? "streets" : "satellite";
        if (!disposed && current.isStyleLoaded() && current.areTilesLoaded()) setError(null);
      });
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => { if (!disposed) current.resize(); });
      });
      observer.observe(container.current);
      setMap(current);
    }).catch((reason: unknown) => {
      if (!disposed) {
        const e = reason instanceof Error ? reason : new Error(String(reason));
        setError("Не удалось запустить WebGL-карту: " + e.message);
        latest.current.onError?.(e);
      }
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(resizeFrame);
      observer?.disconnect();
      canvas?.removeEventListener("webglcontextlost", contextLost);
      canvas?.removeEventListener("webglcontextrestored", contextRestored);
      instance?.remove();
    };
    // Map ownership is mount-scoped; changing props is handled separately.
  }, [container]);
  return { map, ready, error, basemapLoading };
}
