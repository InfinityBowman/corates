/**
 * Tests for PDF Utility Functions
 *
 * INTENDED BEHAVIOR:
 * - readFileAsArrayBuffer: Converts File to ArrayBuffer
 * - extractPdfTitle: Extracts title from metadata or first page text
 * - extractPdfDoi: Extracts DOI from metadata or first page text
 *
 * NOTES:
 * - extractPdfTitle and extractPdfDoi require EmbedPDF engine and are tested with mocks
 * - Title prefix/whitespace cleanup is exercised through extractPdfTitle (cleanTitle is not exported)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock EmbedPDF engine before importing pdfUtils
const mockEngine = {
  openDocumentBuffer: vi.fn(),
  getMetadata: vi.fn(),
  extractText: vi.fn(),
  closeDocument: vi.fn(),
};

vi.mock('../embedPdfEngine.js', () => ({
  initEmbedPdfEngine: vi.fn(() => Promise.resolve(mockEngine)),
}));

import { readFileAsArrayBuffer, extractPdfTitle, extractPdfDoi } from '../pdfUtils';

describe('readFileAsArrayBuffer', () => {
  beforeEach(() => {
    // Reset any mocks
    vi.restoreAllMocks();
  });

  it('should convert File to ArrayBuffer', async () => {
    const content = 'Hello, World!';
    const file = new File([content], 'test.txt', { type: 'text/plain' });

    const result = await readFileAsArrayBuffer(file);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(content.length);
  });

  it('should preserve binary content', async () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
    const blob = new Blob([bytes]);
    const file = new File([blob], 'test.bin', { type: 'application/octet-stream' });

    const result = await readFileAsArrayBuffer(file);
    const resultBytes = new Uint8Array(result);

    expect(resultBytes).toEqual(bytes);
  });

  it('should handle empty file', async () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' });

    const result = await readFileAsArrayBuffer(file);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(0);
  });

  it('should reject on FileReader error', async () => {
    // Create a mock that triggers error
    const originalFileReader = globalThis.FileReader;

    class MockFileReader {
      error: Error | null = null;
      onerror: (() => void) | null = null;
      readAsArrayBuffer() {
        setTimeout(() => {
          this.error = new Error('Read failed');
          this.onerror?.();
        }, 0);
      }
    }

    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    const file = new File(['test'], 'test.txt');

    await expect(readFileAsArrayBuffer(file)).rejects.toThrow();

    globalThis.FileReader = originalFileReader;
  });
});

describe('extractPdfTitle', () => {
  const mockDoc = { id: 'test-doc' };
  const pdfData = new ArrayBuffer(100);

  function mockOpenDocument() {
    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });
  }

  function mockFirstPageText(text: string) {
    mockOpenDocument();
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({ title: null }),
    });
    mockEngine.extractText.mockReturnValue({
      toPromise: () => Promise.resolve(text),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return title from PDF metadata when available', async () => {
    mockOpenDocument();
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({ title: 'Test PDF Title' }),
    });

    const title = await extractPdfTitle(pdfData);

    expect(title).toBe('Test PDF Title');
    expect(mockEngine.openDocumentBuffer).toHaveBeenCalled();
    expect(mockEngine.getMetadata).toHaveBeenCalledWith(mockDoc);
    expect(mockEngine.closeDocument).toHaveBeenCalledWith(mockDoc);
  });

  it('should fall back to first page text when metadata has no title', async () => {
    mockFirstPageText('Important Study About Cats\nAbstract text here...');

    const title = await extractPdfTitle(pdfData);

    expect(title).toBe('Important Study About Cats');
    expect(mockEngine.extractText).toHaveBeenCalledWith(mockDoc, [0]);
  });

  it('cleans whitespace and article prefixes on first-page titles', async () => {
    // cleanTitle is not exported; cases must survive extractPdfTitle's length > 5 filter
    const cases: Array<[string, string]> = [
      ['Original Article: Machine Learning Study', 'Machine Learning Study'],
      ['Research Article - Study on Effects of Treatment', 'Study on Effects of Treatment'],
      ['Review: Systematic Analysis of Trials', 'Systematic Analysis of Trials'],
      ['Article: New Findings About Widgets', 'New Findings About Widgets'],
      ['ORIGINAL ARTICLE: Machine Learning Study', 'Machine Learning Study'],
      ['Original Article Machine Learning Study', 'Machine Learning Study'],
      ['Hello    World About Science', 'Hello World About Science'],
      ['  Hello World About Science  ', 'Hello World About Science'],
      ['Systematic Review of Clinical Trials', 'Systematic Review of Clinical Trials'],
      ['A Systematic Review of Trials', 'A Systematic Review of Trials'],
    ];
    for (const [raw, expected] of cases) {
      mockFirstPageText(raw);
      expect(await extractPdfTitle(pdfData)).toBe(expected);
    }
  });

  it('should return null when no text can be extracted', async () => {
    mockFirstPageText('');

    const title = await extractPdfTitle(pdfData);

    expect(title).toBeNull();
  });

  it('should reject titles that are too short', async () => {
    mockFirstPageText('Hi\nThis is a longer line');

    const title = await extractPdfTitle(pdfData);

    // Should skip "Hi" (too short) and return the next substantial line
    expect(title).toBe('This is a longer line');
  });

  it('should handle PDF parsing errors gracefully', async () => {
    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.reject(new Error('Invalid PDF')),
    });

    await expect(extractPdfTitle(pdfData)).rejects.toThrow();
  });
});

describe('extractPdfDoi', () => {
  const mockDoc = { id: 'test-doc' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract DOI from metadata subject field', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({ subject: 'DOI: 10.1234/test.doi' }),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const doi = await extractPdfDoi(pdfData);

    expect(doi).toBe('10.1234/test.doi');
  });

  it('should extract DOI from metadata keywords field', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({ keywords: '10.5678/example.doi' }),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const doi = await extractPdfDoi(pdfData);

    expect(doi).toBe('10.5678/example.doi');
  });

  it('should extract DOI from custom metadata fields', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () =>
        Promise.resolve({
          custom: {
            doi: '10.9999/custom.doi',
          },
        }),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const doi = await extractPdfDoi(pdfData);

    expect(doi).toBe('10.9999/custom.doi');
  });

  it('should fall back to extracting DOI from first page text', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({}),
    });
    mockEngine.extractText.mockReturnValue({
      toPromise: () => Promise.resolve('This is a study. DOI: 10.1234/page.doi'),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const doi = await extractPdfDoi(pdfData);

    expect(doi).toBe('10.1234/page.doi');
  });

  it('should return null when no DOI is found', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({}),
    });
    mockEngine.extractText.mockReturnValue({
      toPromise: () => Promise.resolve('No DOI in this text'),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const doi = await extractPdfDoi(pdfData);

    expect(doi).toBeNull();
  });

  it('should clean DOI by removing URL prefixes and normalizing', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({}),
    });
    mockEngine.extractText.mockReturnValue({
      toPromise: () => Promise.resolve('https://doi.org/10.1234/test.doi'),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const doi = await extractPdfDoi(pdfData);

    expect(doi).toBe('10.1234/test.doi');
  });
});
