/**
 * PDF utility functions for extracting metadata and text
 */

// PDF.js library reference (loaded dynamically)
let pdfjsLib = null;
let pdfjsInitPromise = null;

/**
 * Initialize PDF.js library lazily
 * This is the shared initialization function used by all PDF-related components
 * @returns {Promise<Object>} - The initialized pdfjs-dist library
 */
export async function initPdfJs() {
  if (pdfjsLib) return pdfjsLib;

  if (pdfjsInitPromise) return pdfjsInitPromise;

  pdfjsInitPromise = (async () => {
    const [pdfjs, workerModule] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);

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
 */
export async function extractPdfTitle(pdfData) {
  try {
    const pdfjs = await initPdfJs();
    const pdf = await pdfjs.getDocument({ data: pdfData }).promise;

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
  } catch (error) {
    console.error('Error extracting PDF title:', error);
    return null;
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
      .replace(/\s+/g, ' ')
      // Remove common prefixes
      .replace(/^(original\s+article|research\s+article|review|article)\s*[:]?\s*/i, '')
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
