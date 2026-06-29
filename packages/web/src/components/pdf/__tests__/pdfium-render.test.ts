/**
 * Guards against the PDFium WASM falling out of sync with the @embedpdf engine.
 *
 * The viewer loads the PDFium runtime from a self-hosted static asset
 * (`packages/web/public/pdfium.wasm`, served at `${LANDING_URL}/pdfium.wasm` --
 * see viewer.tsx). That binary is vendored separately from the npm packages, so
 * a `@embedpdf/*` bump without re-copying the wasm leaves the JS glue calling
 * native functions the stale binary does not export. At runtime that surfaces as
 * `Aborted(Assertion failed: exported native function ... not found)` and the
 * document fails to render -- invisible until a user opens a PDF.
 *
 * Two layers of protection:
 *  1. A fast byte-identity check between the served wasm and the installed
 *     @embedpdf/pdfium package (clear, actionable failure on drift).
 *  2. A real render: load the committed wasm, open a PDF, render a page. This
 *     exercises the native call path (including EPDFDoc_GetPageObjectNumberByIndex,
 *     which populates page.objectNumber on load) so any incompatibility throws.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPdfiumDirectEngine } from '@embedpdf/engines';

const here = path.dirname(fileURLToPath(import.meta.url));
// __tests__ -> pdf -> components -> src -> web (package root)
const SERVED_WASM = path.resolve(here, '../../../../public/pdfium.wasm');
const PACKAGE_WASM = createRequire(import.meta.url).resolve('@embedpdf/pdfium/pdfium.wasm');

const sha256 = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

// A minimal, valid single-page PDF built with correct xref offsets at runtime.
function makeMinimalPdf(): ArrayBuffer {
  const enc = new TextEncoder();
  const content = 'BT /F1 24 Tf 50 100 Td (Hi) Tj ET\n';
  const contentLen = enc.encode(content).length;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${contentLen} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return enc.encode(pdf).buffer;
}

describe('pdfium wasm', () => {
  it('served public/pdfium.wasm is in sync with the installed @embedpdf/pdfium package', () => {
    expect(sha256(SERVED_WASM)).toBe(sha256(PACKAGE_WASM));
    // If this fails after an @embedpdf bump, re-copy the binary:
    //   cp node_modules/@embedpdf/pdfium/dist/pdfium.wasm packages/web/public/pdfium.wasm
  });
});

describe('pdfium engine renders a PDF', () => {
  const realFetch = globalThis.fetch;

  beforeAll(() => {
    // The engine fetches the wasm by URL; serve the committed file from disk instead.
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('pdfium.wasm')) {
        const bytes = readFileSync(SERVED_WASM);
        return { ok: true, arrayBuffer: async () => bytes.buffer.slice(0) } as Response;
      }
      return realFetch(input as RequestInfo);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('loads the committed wasm, opens a document, and renders a page', async () => {
    const engine = await createPdfiumDirectEngine('https://test.local/pdfium.wasm');

    const doc = await engine
      .openDocumentBuffer({ id: 'test', content: makeMinimalPdf() })
      .toPromise();
    expect(doc.pageCount).toBe(1);

    const page = doc.pages[0];
    // objectNumber is populated by EPDFDoc_GetPageObjectNumberByIndex during load --
    // the exact native symbol whose absence caused the production failure.
    expect(typeof page.objectNumber).toBe('number');

    const image = await engine.renderPageRaw(doc, page).toPromise();
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
    expect(image.data.length).toBeGreaterThan(0);

    await engine.closeDocument(doc).toPromise();
  }, 30000);
});
