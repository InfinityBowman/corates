/**
 * PDF utility functions for extracting metadata and text
 */

import { initEmbedPdfEngine } from './embedPdfEngine.js';

// PDF.js library reference (loaded dynamically)
// Kept for pdfDocument.js compatibility (viewing still uses PDF.js)
let pdfjsLib = null;
let pdfjsInitPromise = null;

// DOI regex pattern
const DOI_REGEX = /\b(10\.\d{4,}(?:\.\d+)*\/\S+)\b/gi;

// Timeout constants
const PDF_INIT_TIMEOUT = 10000; // 10 seconds for PDF.js initialization
const PDF_EXTRACT_TIMEOUT = 10000; // 10 seconds for title/DOI extraction

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} operationName - Name of the operation for error messages
 * @returns {Promise} - The promise with timeout
 */
export function withTimeout(promise, ms, operationName = 'Operation') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${ms / 1000} seconds`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Initialize PDF.js library lazily
 * This is the shared initialization function used by all PDF-related components
 * @returns {Promise<Object>} - The initialized pdfjs-dist library
 */
export async function initPdfJs() {
  if (pdfjsLib) return pdfjsLib;

  if (pdfjsInitPromise) return pdfjsInitPromise;

  pdfjsInitPromise = (async () => {
    const [pdfjs, workerModule] = await withTimeout(
      Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]),
      PDF_INIT_TIMEOUT,
      'PDF.js initialization',
    );

    pdfjsLib = pdfjs;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

    return pdfjsLib;
  })();

  return pdfjsInitPromise;
}

/**
 * Extract title from a PDF file
 * Tries metadata first, then extracts from first page text
 * @param {ArrayBuffer} pdfData - The PDF file as ArrayBuffer
 * @returns {Promise<string>} - The extracted title or fallback
 * @throws {Error} - If extraction times out or fails
 */
export async function extractPdfTitle(pdfData) {
  return withTimeout(extractPdfTitleInternal(pdfData), PDF_EXTRACT_TIMEOUT, 'PDF title extraction');
}

/**
 * Internal implementation of title extraction (without timeout wrapper)
 */
async function extractPdfTitleInternal(pdfData) {
  const engine = await initEmbedPdfEngine();

  // Generate unique document ID for this extraction
  const docId = `title-extract-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Clone ArrayBuffer since EmbedPDF may detach it
  const pdfBuffer = pdfData.slice(0);

  let doc = null;
  try {
    // Open document
    doc = await engine.openDocumentBuffer({ id: docId, content: pdfBuffer }).toPromise();

    // Try to get title from PDF metadata first
    const metadata = await engine.getMetadata(doc).toPromise();
    if (metadata?.title && metadata.title.trim()) {
      return metadata.title.trim();
    }

    // Fall back to extracting from first page text
    const pageText = await engine.extractText(doc, [0]).toPromise();

    if (!pageText || !pageText.trim()) {
      return null;
    }

    // Split text into lines and find first substantial line
    const lines = pageText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Find first substantial line (likely the title)
    for (const line of lines.slice(0, 20)) {
      // Check first 20 lines
      const cleaned = cleanTitle(line);
      if (cleaned.length > 5 && cleaned.length < 300) {
        return cleaned;
      }
    }

    // Fallback: use first substantial line regardless of length check
    for (const line of lines) {
      const cleaned = cleanTitle(line);
      if (cleaned.length > 10 && cleaned.length < 300) {
        return cleaned;
      }
    }

    return null;
  } finally {
    if (doc) {
      try {
        await engine.closeDocument(doc).toPromise();
      } catch (err) {
        // Ignore close errors
        console.warn('Error closing PDF document:', err);
      }
    }
  }
}

/**
 * Clean up extracted title text
 */
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

/**
 * Read a File as ArrayBuffer
 * @param {File} file - The file to read
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extract DOI from PDF metadata or first page text
 * @param {ArrayBuffer} pdfData - The PDF file as ArrayBuffer
 * @returns {Promise<string|null>} - The extracted DOI or null
 * @throws {Error} - If extraction times out or fails
 */
export async function extractPdfDoi(pdfData) {
  return withTimeout(extractPdfDoiInternal(pdfData), PDF_EXTRACT_TIMEOUT, 'PDF DOI extraction');
}

/**
 * Internal implementation of DOI extraction (without timeout wrapper)
 */
async function extractPdfDoiInternal(pdfData) {
  const engine = await initEmbedPdfEngine();

  // Generate unique document ID for this extraction
  const docId = `doi-extract-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Clone ArrayBuffer since EmbedPDF may detach it
  const pdfBuffer = pdfData.slice(0);

  let doc = null;
  try {
    // Open document
    doc = await engine.openDocumentBuffer({ id: docId, content: pdfBuffer }).toPromise();

    // Try metadata first
    const metadata = await engine.getMetadata(doc).toPromise();

    // Check standard metadata fields that commonly contain DOI
    const fieldsToCheck = [
      metadata.subject,
      metadata.keywords,
      metadata.title,
      metadata.author,
    ].filter(Boolean);

    for (const fieldValue of fieldsToCheck) {
      const match = String(fieldValue).match(DOI_REGEX);
      if (match) {
        return cleanDoi(match[0]);
      }
    }

    // Check custom metadata fields
    if (metadata?.custom) {
      for (const [key, value] of Object.entries(metadata.custom)) {
        if (value && /doi/i.test(key)) {
          const match = String(value).match(DOI_REGEX);
          if (match) {
            return cleanDoi(match[0]);
          }
        }
        // Also check the value itself for DOI pattern
        if (value) {
          const match = String(value).match(DOI_REGEX);
          if (match) {
            return cleanDoi(match[0]);
          }
        }
      }
    }

    // Fall back to extracting from first page text
    const pageText = await engine.extractText(doc, [0]).toPromise();

    if (pageText) {
      const textMatch = pageText.match(DOI_REGEX);
      if (textMatch) {
        return cleanDoi(textMatch[0]);
      }
    }

    return null;
  } finally {
    if (doc) {
      try {
        await engine.closeDocument(doc).toPromise();
      } catch (err) {
        // Ignore close errors
        console.warn('Error closing PDF document:', err);
      }
    }
  }
}

/**
 * Clean and normalize a DOI string
 */
function cleanDoi(doi) {
  if (!doi) return null;

  // Remove common prefixes
  let cleaned = doi
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .trim();

  // Remove trailing punctuation and common trailing artifacts
  cleaned = cleaned
    .replace(/[.,;)\]}>]+$/, '')
    // Remove anything after quotes, brackets, or common JSON delimiters
    .replace(/["'\]},].*$/, '')
    // Remove URL-encoded characters that might have been included
    .replace(/%22.*$/, '') // Stop at URL-encoded quote
    .replace(/%2C.*$/, '') // Stop at URL-encoded comma
    .replace(/%7D.*$/, '') // Stop at URL-encoded }
    .trim();

  return cleaned.toLowerCase();
}

/**
 * Normalize a title for comparison (lowercase, remove punctuation, extra spaces)
 * @param {string} title
 * @returns {string}
 */
export function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
