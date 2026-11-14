/** VS Code previews run inside a nested Electron webview, where two WebGL canvases are expensive. */
export function isEmbeddedPreview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch { return true; }
  return /Electron|vscode-webview|Code\//i.test(navigator.userAgent);
}
export function mapPixelRatio(dpr: number, embedded: boolean): number {
  return Math.min(Math.max(dpr || 1, 0.75), embedded ? 1 : 1.5);
}
