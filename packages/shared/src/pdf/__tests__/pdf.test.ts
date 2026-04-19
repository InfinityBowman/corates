/**
 * Tests for PDF validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isValidPdfFilename,
  isPdfSignature,
  formatFileSize,
  validatePdfStructure,
} from '../index.js';

describe('isValidPdfFilename', () => {
  it.each([
    'document.pdf',
    'My Research Paper (2024).pdf',
    'file-with-dashes_and_underscores.pdf',
    'UPPERCASE.PDF',
    'a'.repeat(196) + '.pdf',
  ])('accepts valid filename: %s', (name) => {
    expect(isValidPdfFilename(name)).toBe(true);
  });

  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    ['', 'empty string'],
    ['document.txt', 'wrong extension'],
    ['.pdf', 'no basename'],
    ['../file.pdf', 'path traversal'],
    ['path/to/file.pdf', 'forward slash'],
    ['path\\to\\file.pdf', 'backslash'],
    ['file"name.pdf', 'quotes'],
    ['file\x00name.pdf', 'control character'],
    ['a'.repeat(201) + '.pdf', 'exceeds max length'],
  ])('rejects invalid filename (%s): %s', (name) => {
    expect(isValidPdfFilename(name)).toBe(false);
  });
});

describe('isPdfSignature', () => {
  it('should return true for valid PDF signature', () => {
    const validPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(isPdfSignature(validPdf)).toBe(true);
  });

  it('should return true for exactly 5 bytes matching signature', () => {
    const exactBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(isPdfSignature(exactBytes)).toBe(true);
  });

  it('should return false for invalid signature', () => {
    const notPdf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]); // ZIP file
    expect(isPdfSignature(notPdf)).toBe(false);
  });

  it('should return false for too few bytes', () => {
    const tooShort = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // Only 4 bytes
    expect(isPdfSignature(tooShort)).toBe(false);
  });

  it('should return false for empty array', () => {
    expect(isPdfSignature(new Uint8Array([]))).toBe(false);
    expect(isPdfSignature([])).toBe(false);
  });

  it('should work with regular number array', () => {
    const asArray = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];
    expect(isPdfSignature(asArray)).toBe(true);
  });
});

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1.0 MB'],
    [50 * 1024 * 1024, '50.0 MB'],
  ])('formats %d as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});

describe('validatePdfStructure', () => {
  // Helper to create a valid PDF-like buffer
  function createPdfBuffer(options: { includeHeader?: boolean; includeEof?: boolean } = {}) {
    const { includeHeader = true, includeEof = true } = options;

    const header = includeHeader ? '%PDF-1.4\n' : 'not a pdf\n';
    const body = '%some pdf content here\n';
    const footer = includeEof ? '\n%%EOF\n' : '\nno eof here\n';

    const content = header + body + footer;
    const encoder = new TextEncoder();
    return encoder.encode(content);
  }

  it('should accept valid PDF with header and EOF', () => {
    const pdf = createPdfBuffer({ includeHeader: true, includeEof: true });
    const result = validatePdfStructure(pdf);
    expect(result.valid).toBe(true);
  });

  it('should reject file without PDF header', () => {
    const notPdf = createPdfBuffer({ includeHeader: false, includeEof: true });
    const result = validatePdfStructure(notPdf);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Not a valid PDF file');
    }
  });

  it('should reject PDF without EOF marker', () => {
    const truncated = createPdfBuffer({ includeHeader: true, includeEof: false });
    const result = validatePdfStructure(truncated);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('missing EOF');
    }
  });

  it('should work with ArrayBuffer input', () => {
    const pdf = createPdfBuffer({ includeHeader: true, includeEof: true });
    const arrayBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const result = validatePdfStructure(arrayBuffer);
    expect(result.valid).toBe(true);
  });
});
