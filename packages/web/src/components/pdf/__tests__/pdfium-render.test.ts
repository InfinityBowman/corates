/**
 * Guards against the PDFium WASM falling out of sync with the @embedpdf engine.
 *
 * The viewer loads the PDFium runtime from the installed @embedpdf/pdfium package
 * via a Vite `?url` import (see lib/pdfiumWasmUrl.ts), which emits a content-hashed
 * /assets/* asset. The package is the single source of truth, so the JS glue and
 * the binary can never drift -- the failure that previously surfaced as
 * `Aborted(Assertion failed: exported native function ... not found)` when a stale
 * vendored wasm was served against newer glue.
 *
 * This still exercises the native call path end to end: load the package wasm,
 * open a PDF, render a page (including EPDFDoc_GetPageObjectNumberByIndex, which
 * populates page.objectNumber on load) so any incompatibility throws.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createPdfiumDirectEngine } from '@embedpdf/engines';

const PACKAGE_WASM = createRequire(import.meta.url).resolve('@embedpdf/pdfium/pdfium.wasm');

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

describe('pdfium engine renders a PDF', () => {
  const realFetch = globalThis.fetch;

  beforeAll(() => {
    // The engine fetches the wasm by URL; serve the installed package binary from disk instead.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('pdfium.wasm')) {
        const bytes = readFileSync(PACKAGE_WASM);
        return { ok: true, arrayBuffer: async () => bytes.buffer.slice(0) } as Response;
      }
      return realFetch(input, init);
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
