"use client";
import { useEffect, useRef } from "react";
import type { Map } from "maplibre-gl";
import type { CameraState } from "./types/map.types";
import { DEFAULT_VIEW } from "./lib/map-config";
import { spaceCanvasSize, spaceVisibility } from "./lib/space-camera";
import { isEmbeddedPreview } from "./lib/render-performance";
import { createSpaceRenderer, type SpaceRenderer } from "./lib/space-renderer";
import panorama from "./assets/cosmic-sky.webp";
import s from "./earth-map.module.css";

/** Cache the sky across projection changes; embedded previews use the lightweight panorama. */
export function SpaceBackdrop({ map, initialView, active = true }: { map: Map | null; initialView?: Partial<CameraState>; active?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const initial = useRef({ ...DEFAULT_VIEW, ...initialView });
  const enabled = useRef(active);
  const invalidate = useRef<(() => void) | null>(null);
  useEffect(() => {
    enabled.current = active;
    if (active) invalidate.current?.();
  }, [active]);
  useEffect(() => {
    const element = root.current, surface = canvas.current;
    if (!map || !element || !surface) return;
    let disposed = false;
    let initialized = false;
    let frame = 0;
    let renderer: SpaceRenderer | null = null;
    const lightweight = isEmbeddedPreview();
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const frozen = initial.current;
    const draw = () => {
      frame = 0;
      if (disposed || !enabled.current || document.hidden) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const center = map.getCenter();
      const current: CameraState = {
        center: { lng: center.lng, lat: center.lat },
        zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(),
      };
      const visible = spaceVisibility(current.zoom);
      element.style.opacity = String(visible);
      if (visible <= 0) return;
      // Lazy allocation. Switching 2D/3D never recompiles an existing sky program.
      if (!initialized) {
        initialized = true;
        renderer = lightweight ? null : createSpaceRenderer(surface, panorama.src, schedule);
        surface.style.visibility = renderer ? "visible" : "hidden";
        element.dataset.renderer = renderer ? "webgl2" : "panorama";
      }
      const camera = motion?.matches ? { ...frozen, zoom: current.zoom } : current;
      if (!renderer) {
        const tileWidth = rect.height * 3.2;
        element.style.backgroundPosition = (-camera.center.lng / 360 * tileWidth) + "px " + (50 + camera.center.lat * 0.25) + "%";
        return;
      }
      const [width, height] = spaceCanvasSize(rect.width, rect.height, window.devicePixelRatio || 1);
      if (surface.width !== width || surface.height !== height) { surface.width = width; surface.height = height; }
      const mapRect = map.getCanvas().getBoundingClientRect();
      const view = mapRect.width > 0 ? mapRect : rect;
      const sx = width / rect.width, sy = height / rect.height;
      renderer.render({
        camera, roll: motion?.matches ? 0 : map.getRoll(),
        viewport: [(view.left - rect.left) * sx, (rect.bottom - view.bottom) * sy, view.width * sx, view.height * sy],
      });
    };
    const schedule = () => {
      if (!disposed && enabled.current && !frame && !document.hidden) frame = requestAnimationFrame(draw);
    };
    invalidate.current = schedule;
    const lost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame); frame = 0;
      renderer?.dispose(false); renderer = null;
      surface.style.visibility = "hidden";
      initialized = true;
      schedule();
    };
    const restored = () => { if (!disposed) { initialized = false; schedule(); } };
    surface.addEventListener("webglcontextlost", lost);
    surface.addEventListener("webglcontextrestored", restored);
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    map.on("move", schedule); map.on("resize", schedule);
    motion?.addEventListener?.("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      disposed = true; invalidate.current = null;
      cancelAnimationFrame(frame); observer.disconnect();
      map.off("move", schedule); map.off("resize", schedule);
      motion?.removeEventListener?.("change", schedule);
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("resize", schedule);
      surface.removeEventListener("webglcontextlost", lost);
      surface.removeEventListener("webglcontextrestored", restored);
      renderer?.dispose();
    };
  }, [map]);
  return <div ref={root} className={s.spaceBackdrop} hidden={!active} aria-hidden="true" data-space-backdrop=""
    style={{ backgroundImage: 'url("' + panorama.src + '")' }}>
    <canvas ref={canvas} className={s.spaceCanvas} />
  </div>;
}
