/** Shared Citrinet assets (same build as pronounce-try on GitHub Pages). */
export const CHECKER_CDN = "https://mrjkorea.github.io/pronounce-try/";

export function checkerAssetUrl(rel) {
  const path = String(rel || "").replace(/^\//, "");
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, CHECKER_CDN).href;
}

export function ortWasmPaths() {
  const base = checkerAssetUrl("vendor/ort/");
  return base;
}
