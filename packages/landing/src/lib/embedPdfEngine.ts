/**
 * EmbedPDF engine initialization for programmatic PDF operations
 * Provides singleton engine instance for text and metadata extraction
 * Modules are loaded dynamically to reduce initial bundle size
 */

// EmbedPDF libraries don't ship type declarations

let engineInstance: any = null;

let engineInitPromise: Promise<any> | null = null;

// Timeout constant for engine initialization
const ENGINE_INIT_TIMEOUT = 15000; // 15 seconds for WASM loading
const MODULE_LOAD_TIMEOUT = 10000; // 10 seconds for module loading

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, operationName = 'Operation'): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
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
 */

export async function initEmbedPdfEngine(): Promise<any> {
  if (engineInstance) return engineInstance;

  if (engineInitPromise) return engineInitPromise;

  engineInitPromise = (async () => {
    try {
      // Dynamically import EmbedPDF modules (no type declarations available)
      const [{ init }, { PdfiumNative, PdfEngine }, { ConsoleLogger }] = await withTimeout(
        Promise.all([
          import('@embedpdf/pdfium'),
          import('@embedpdf/engines/pdfium'),
          import('@embedpdf/models'),
        ]),
        MODULE_LOAD_TIMEOUT,
        'EmbedPDF module loading',
      );

      const wasmUrl = '/pdfium.wasm';
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

      // Create high-level engine (cast options due to incomplete type declarations)

      engineInstance = new PdfEngine(native, { logger: new ConsoleLogger() } as any);

      return engineInstance;
    } catch (error) {
      // Reset promise on error so it can be retried
      engineInitPromise = null;
      throw error;
    }
  })();

  return engineInitPromise;
}
