/**
 * PDF utility functions for extracting metadata and text
 */

// PDF.js library reference (loaded dynamically)
let pdfjsLib = null;
let pdfjsInitPromise = null;

// DOI regex pattern
const DOI_REGEX = /\b(10\.\d{4,}(?:\.\d+)*\/\S+)\b/gi;

// Timeout constants
const PDF_INIT_TIMEOUT = 10_000; // 10 seconds for PDF.js initialization
const PDF_EXTRACT_TIMEOUT = 10_000; // 10 seconds for title/DOI extraction

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
  const pdfjs = await initPdfJs();
  // verbosity: 0 = ERRORS only (suppress warnings about malformed PDFs)
  const pdf = await pdfjs.getDocument({ data: pdfData, verbosity: 0 }).promise;

  try {
    // Try to get title from PDF metadata first
    const metadata = await pdf.getMetadata();
    if (metadata?.info?.Title && metadata.info.Title.trim()) {
      return metadata.info.Title.trim();
    }

    // Fall back to extracting from first page text
    const firstPage = await pdf.getPage(1);
    const textContent = await firstPage.getTextContent();

    // Get text items from the first page
    const textItems = textContent.items;
    if (!textItems || textItems.length === 0) {
      return null;
    }

    // Strategy: Find the largest font size text on the first page (likely the title)
    // Group text by approximate y-position to find lines
    const lines = groupTextIntoLines(textItems);

    // Find the line with the largest font size (likely the title)
    let titleLine = null;
    let maxFontSize = 0;

    for (const line of lines.slice(0, 10)) {
      // Only check first 10 lines
      const avgFontSize = line.reduce((sum, item) => sum + (item.height || 12), 0) / line.length;
      if (avgFontSize > maxFontSize) {
        maxFontSize = avgFontSize;
        titleLine = line;
      }
    }

    if (titleLine) {
      const title = titleLine
        .map(item => item.str)
        .join(' ')
        .trim();
      if (title.length > 5 && title.length < 300) {
        return cleanTitle(title);
      }
    }

    // Fallback: just use the first substantial line of text
    for (const line of lines) {
      const text = line
        .map(item => item.str)
        .join(' ')
        .trim();
      if (text.length > 10 && text.length < 300) {
        return cleanTitle(text);
      }
    }

    return null;
  } finally {
    if (pdf) {
      await pdf.destroy();
    }
  }
}

/**
 * Group text items into lines based on y-position
 */
function groupTextIntoLines(textItems) {
  const lines = [];
  let currentLine = [];
  let lastY = null;
  const yThreshold = 5; // pixels

  // Sort by y position (descending, since PDF coords start from bottom)
  const sorted = [...textItems].sort((a, b) => b.transform[5] - a.transform[5]);

  for (const item of sorted) {
    if (!item.str.trim()) continue;

    const y = item.transform[5];

    if (lastY === null || Math.abs(y - lastY) < yThreshold) {
      currentLine.push(item);
    } else {
      if (currentLine.length > 0) {
        // Sort line items by x position
        currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
        lines.push(currentLine);
      }
      currentLine = [item];
    }
    lastY = y;
  }

  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Clean up extracted title text
 */
function cleanTitle(title) {
  return (
    title
      // Remove excessive whitespace
      .replaceAll(/\s+/g, ' ')
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
  const pdfjs = await initPdfJs();
  const pdf = await pdfjs.getDocument({ data: pdfData, verbosity: 0 }).promise;

  try {
    // Try metadata first
    const metadata = await pdf.getMetadata();

    // Check specific metadata fields that commonly contain DOI
    const info = metadata?.info || {};

    // Check common DOI fields directly
    const doiFields = ['doi', 'DOI', 'Subject', 'Keywords', 'Description'];
    for (const field of doiFields) {
      if (info[field]) {
        const fieldValue = String(info[field]);
        const match = fieldValue.match(DOI_REGEX);
        if (match) {
          return cleanDoi(match[0]);
        }
      }
    }

    // Check custom metadata
    if (metadata?.metadata?._metadataMap) {
      for (const [key, value] of metadata.metadata._metadataMap) {
        const valueString = String(value || '');
        if (valueString && /doi/i.test(key)) {
          const match = valueString.match(DOI_REGEX);
          if (match) {
            return cleanDoi(match[0]);
          }
        }
      }
    }

    // Fall back to extracting from first page text
    const firstPage = await pdf.getPage(1);
    const textContent = await firstPage.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');

    const textMatch = pageText.match(DOI_REGEX);
    if (textMatch) {
      return cleanDoi(textMatch[0]);
    }

    return null;
  } finally {
    if (pdf) {
      await pdf.destroy();
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
    .replaceAll(/[^\w\s]/g, '') // Remove punctuation
    .replaceAll(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
