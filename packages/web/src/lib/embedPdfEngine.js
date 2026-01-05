/**
 * EmbedPDF engine initialization for programmatic PDF operations
 * Provides singleton engine instance for text and metadata extraction
 * Modules are loaded dynamically to reduce initial bundle size
 */

// Engine instance and initialization promise
let engineInstance = null;
let engineInitPromise = null;

// Timeout constant for engine initialization
const ENGINE_INIT_TIMEOUT = 15000; // 15 seconds for WASM loading
const MODULE_LOAD_TIMEOUT = 10000; // 10 seconds for module loading

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} operationName - Name of the operation for error messages
 * @returns {Promise} - The promise with timeout
 */
function withTimeout(promise, ms, operationName = 'Operation') {
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
 * Initialize EmbedPDF engine lazily
 * Loads PDFium WASM and creates engine instance
 * @returns {Promise<PdfEngine>} - The initialized EmbedPDF engine
 */
export async function initEmbedPdfEngine() {
  if (engineInstance) return engineInstance;

  if (engineInitPromise) return engineInitPromise;

  engineInitPromise = (async () => {
    try {
      // Dynamically import EmbedPDF modules
      const [{ init }, { PdfiumNative, PdfEngine }, { ConsoleLogger }] = await withTimeout(
        Promise.all([
          import('@embedpdf/pdfium'),
          import('@embedpdf/engines/pdfium'),
          import('@embedpdf/models'),
        ]),
        MODULE_LOAD_TIMEOUT,
        'EmbedPDF module loading',
      );

      // Load PDFium WASM from CDN
      const wasmUrl = 'https://cdn.jsdelivr.net/npm/@embedpdf/pdfium/dist/pdfium.wasm';
      const response = await withTimeout(fetch(wasmUrl), ENGINE_INIT_TIMEOUT, 'PDFium WASM fetch');

      if (!response.ok) {
        throw new Error(`Failed to fetch PDFium WASM: ${response.status} ${response.statusText}`);
      }

      const wasmBinary = await withTimeout(
        response.arrayBuffer(),
        ENGINE_INIT_TIMEOUT,
        'PDFium WASM arrayBuffer',
      );

      // Initialize PDFium module
      const pdfiumModule = await withTimeout(
        init({ wasmBinary }),
        ENGINE_INIT_TIMEOUT,
        'PDFium initialization',
      );

      // Create native executor
      const native = new PdfiumNative(pdfiumModule, { logger: new ConsoleLogger() });

      // Create high-level engine
      engineInstance = new PdfEngine(native, { logger: new ConsoleLogger() });

      return engineInstance;
    } catch (error) {
      // Reset promise on error so it can be retried
      engineInitPromise = null;
      throw error;
    }
  })();

  return engineInitPromise;
}
