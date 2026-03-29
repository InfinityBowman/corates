/**
 * Tests for PDF Utility Functions
 *
 * INTENDED BEHAVIOR:
 * - cleanTitle: Removes excessive whitespace and common article prefixes
 * - readFileAsArrayBuffer: Converts File to ArrayBuffer
 * - extractPdfTitle: Extracts title from metadata or first page text
 * - extractPdfDoi: Extracts DOI from metadata or first page text
 *
 * NOTES:
 * - extractPdfTitle and extractPdfDoi require EmbedPDF engine and are tested with mocks
 * - cleanTitle is internal but tested for correctness
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

// Recreate internal function for testing since it's not exported
function cleanTitle(title) {
  return (
    title
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove common prefixes (with optional : or -)
      .replace(/^(original\s+article|research\s+article|review|article)\s*[:|-]?\s*/i, '')
      .trim()
  );
}

describe('cleanTitle', () => {
  describe('whitespace normalization', () => {
    it('should collapse multiple spaces into single space', () => {
      expect(cleanTitle('Hello    World')).toBe('Hello World');
    });

    it('should normalize tabs and newlines to spaces', () => {
      expect(cleanTitle('Hello\t\tWorld')).toBe('Hello World');
      expect(cleanTitle('Hello\n\nWorld')).toBe('Hello World');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(cleanTitle('  Hello World  ')).toBe('Hello World');
    });
  });

  describe('prefix removal', () => {
    it('should remove "Original Article:" prefix', () => {
      expect(cleanTitle('Original Article: Study on Effects')).toBe('Study on Effects');
    });

    it('should remove "Research Article -" prefix', () => {
      expect(cleanTitle('Research Article - Study on Effects')).toBe('Study on Effects');
    });

    it('should remove "Review" prefix', () => {
      expect(cleanTitle('Review: Systematic Analysis')).toBe('Systematic Analysis');
    });

    it('should remove "Article" prefix', () => {
      expect(cleanTitle('Article: New Findings')).toBe('New Findings');
    });

    it('should be case-insensitive for prefix removal', () => {
      expect(cleanTitle('ORIGINAL ARTICLE: Study')).toBe('Study');
      expect(cleanTitle('research article: Study')).toBe('Study');
      expect(cleanTitle('REVIEW: Analysis')).toBe('Analysis');
    });

    it('should handle prefix without separator', () => {
      expect(cleanTitle('Original Article Study')).toBe('Study');
    });

    it('should handle multiple spaces after prefix', () => {
      expect(cleanTitle('Research Article:    Study')).toBe('Study');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for empty input', () => {
      expect(cleanTitle('')).toBe('');
    });

    it('should return empty string for whitespace-only input', () => {
      expect(cleanTitle('   ')).toBe('');
    });

    it('should preserve title that does not start with known prefix', () => {
      expect(cleanTitle('Systematic Review of Clinical Trials')).toBe(
        'Systematic Review of Clinical Trials',
      );
    });

    it('should not remove "review" when it appears in the middle of title', () => {
      // BUG?: Current regex only removes prefix at the start
      expect(cleanTitle('A Systematic Review')).toBe('A Systematic Review');
    });
  });
});

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
      readAsArrayBuffer() {
        setTimeout(() => {
          this.error = new Error('Read failed');
          this.onerror();
        }, 0);
      }
    }

    globalThis.FileReader = MockFileReader;

    const file = new File(['test'], 'test.txt');

    await expect(readFileAsArrayBuffer(file)).rejects.toThrow();

    globalThis.FileReader = originalFileReader;
  });
});

describe('extractPdfTitle', () => {
  const mockDoc = { id: 'test-doc' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return title from PDF metadata when available', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({ title: 'Test PDF Title' }),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const title = await extractPdfTitle(pdfData);

    expect(title).toBe('Test PDF Title');
    expect(mockEngine.openDocumentBuffer).toHaveBeenCalled();
    expect(mockEngine.getMetadata).toHaveBeenCalledWith(mockDoc);
    expect(mockEngine.closeDocument).toHaveBeenCalledWith(mockDoc);
  });

  it('should fall back to first page text when metadata has no title', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({ title: null }),
    });
    mockEngine.extractText.mockReturnValue({
      toPromise: () => Promise.resolve('Important Study About Cats\nAbstract text here...'),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const title = await extractPdfTitle(pdfData);

    expect(title).toBe('Important Study About Cats');
    expect(mockEngine.extractText).toHaveBeenCalledWith(mockDoc, [0]);
  });

  it('should clean extracted title of prefixes', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({ title: null }),
    });
    mockEngine.extractText.mockReturnValue({
      toPromise: () => Promise.resolve('Original Article: Machine Learning Study'),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const title = await extractPdfTitle(pdfData);

    expect(title).toBe('Machine Learning Study');
  });

  it('should return null when no text can be extracted', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({ title: null }),
    });
    mockEngine.extractText.mockReturnValue({
      toPromise: () => Promise.resolve(''),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const title = await extractPdfTitle(pdfData);

    expect(title).toBeNull();
  });

  it('should reject titles that are too short', async () => {
    const pdfData = new ArrayBuffer(100);

    mockEngine.openDocumentBuffer.mockReturnValue({
      toPromise: () => Promise.resolve(mockDoc),
    });
    mockEngine.getMetadata.mockReturnValue({
      toPromise: () => Promise.resolve({ title: null }),
    });
    mockEngine.extractText.mockReturnValue({
      toPromise: () => Promise.resolve('Hi\nThis is a longer line'),
    });
    mockEngine.closeDocument.mockReturnValue({
      toPromise: () => Promise.resolve(),
    });

    const title = await extractPdfTitle(pdfData);

    // Should skip "Hi" (too short) and return the next substantial line
    expect(title).toBe('This is a longer line');
  });

  it('should handle PDF parsing errors gracefully', async () => {
    const pdfData = new ArrayBuffer(100);

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
