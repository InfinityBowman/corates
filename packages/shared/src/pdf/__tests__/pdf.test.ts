/**
 * Tests for PDF validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  PDF_LIMITS,
  PDF_MAGIC_BYTES,
  isValidPdfFilename,
  isPdfSignature,
  formatFileSize,
  validatePdfStructure,
} from '../index.js';

describe('PDF_LIMITS', () => {
  it('should have MAX_SIZE of 50MB', () => {
    expect(PDF_LIMITS.MAX_SIZE).toBe(50 * 1024 * 1024);
  });

  it('should have MAX_FILENAME_LENGTH of 200', () => {
    expect(PDF_LIMITS.MAX_FILENAME_LENGTH).toBe(200);
  });
});

describe('PDF_MAGIC_BYTES', () => {
  it('should be %PDF- signature', () => {
    expect(PDF_MAGIC_BYTES).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
    // Verify these decode to '%PDF-'
    const str = String.fromCharCode(...PDF_MAGIC_BYTES);
    expect(str).toBe('%PDF-');
  });
});

describe('isValidPdfFilename', () => {
  it('should accept valid filenames', () => {
    expect(isValidPdfFilename('document.pdf')).toBe(true);
    expect(isValidPdfFilename('My Research Paper (2024).pdf')).toBe(true);
    expect(isValidPdfFilename('file-with-dashes_and_underscores.pdf')).toBe(true);
    expect(isValidPdfFilename('a.pdf')).toBe(true);
    expect(isValidPdfFilename('UPPERCASE.PDF')).toBe(true);
    expect(isValidPdfFilename('MixedCase.Pdf')).toBe(true);
  });

  it('should reject null or undefined', () => {
    expect(isValidPdfFilename(null)).toBe(false);
    expect(isValidPdfFilename(undefined)).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidPdfFilename('')).toBe(false);
  });

  it('should reject filenames without .pdf extension', () => {
    expect(isValidPdfFilename('document')).toBe(false);
    expect(isValidPdfFilename('document.txt')).toBe(false);
    expect(isValidPdfFilename('document.pdf.txt')).toBe(false);
    expect(isValidPdfFilename('a')).toBe(false);
  });

  it('should reject filenames that are only whitespace before extension', () => {
    expect(isValidPdfFilename('.pdf')).toBe(false);
    expect(isValidPdfFilename('   .pdf')).toBe(false);
  });

  it('should reject path traversal sequences', () => {
    expect(isValidPdfFilename('../file.pdf')).toBe(false);
    expect(isValidPdfFilename('..\\file.pdf')).toBe(false);
    expect(isValidPdfFilename('foo/../bar.pdf')).toBe(false);
    expect(isValidPdfFilename('file..pdf')).toBe(false);
  });

  it('should reject filenames with forward slashes', () => {
    expect(isValidPdfFilename('path/to/file.pdf')).toBe(false);
    expect(isValidPdfFilename('/file.pdf')).toBe(false);
  });

  it('should reject filenames with backslashes', () => {
    expect(isValidPdfFilename('path\\to\\file.pdf')).toBe(false);
    expect(isValidPdfFilename('\\file.pdf')).toBe(false);
  });

  it('should reject filenames with quotes', () => {
    expect(isValidPdfFilename('file"name.pdf')).toBe(false);
    expect(isValidPdfFilename('"file.pdf"')).toBe(false);
  });

  it('should reject filenames with control characters', () => {
    expect(isValidPdfFilename('file\x00name.pdf')).toBe(false);
    expect(isValidPdfFilename('file\nname.pdf')).toBe(false);
    expect(isValidPdfFilename('file\tname.pdf')).toBe(false);
  });

  it('should reject filenames exceeding max length', () => {
    const longName = 'a'.repeat(201) + '.pdf';
    expect(isValidPdfFilename(longName)).toBe(false);
  });

  it('should accept filenames at max length', () => {
    const maxName = 'a'.repeat(196) + '.pdf'; // 200 chars total
    expect(isValidPdfFilename(maxName)).toBe(true);
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
  it('should format bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10240)).toBe('10.0 KB');
  });

  it('should format megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(50 * 1024 * 1024)).toBe('50.0 MB');
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
