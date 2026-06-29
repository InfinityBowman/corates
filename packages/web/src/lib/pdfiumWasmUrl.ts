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

export const PDFIUM_WASM_URL: string = wasmUrl;
