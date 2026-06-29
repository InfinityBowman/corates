/**
 * Single source of truth for the self-hosted PDFium WASM URL.
 *
 * Resolving the binary through Vite (`?url`) emits a content-hashed asset under
 * /assets/, so the URL changes whenever the @embedpdf/pdfium package changes.
 * That keeps the 1-year `immutable` cache on /assets/* safe: a stale binary can
 * never be served against newer JS glue -- the mismatch that surfaced in
 * production as `Aborted(Assertion failed: exported native function ... not found)`.
 *
 * The installed package is the single source of truth; there is no separate
 * vendored copy to keep in sync.
 */
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';

/**
 * The PDFium engine runs in a Worker created from a `blob:` URL, and the worker
 * fetches this binary itself. Root-relative URLs (what Vite emits for `?url`
 * assets, e.g. `/assets/pdfium-<hash>.wasm`) cannot be resolved against a `blob:`
 * base -- the fetch throws and the engine hangs in a perpetual loading state. So
 * resolve to an absolute URL against the page origin on the client. (During SSR /
 * prerender there is no `window`; the value is never used server-side.)
 */
export const PDFIUM_WASM_URL: string =
  typeof window !== 'undefined' ? new URL(wasmUrl, window.location.origin).href : wasmUrl;
