/**
 * PdfViewer - Component for viewing PDF files
 * Supports zoom, page navigation, file upload, and persistent PDF data
 */

import { createSignal, createEffect, onCleanup, onMount, Show } from 'solid-js';

// PDF.js library reference (loaded dynamically)
let pdfjsLib = null;
let pdfjsInitPromise = null;

// Initialize PDF.js library lazily
async function initPdfJs() {
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

export default function PdfViewer(props) {
  // props.pdfData - ArrayBuffer of saved PDF data (optional)
  // props.pdfFileName - Name of the saved PDF file (optional)
  // props.onPdfChange - Callback when PDF changes: (data: ArrayBuffer, fileName: string) => void
  // props.onPdfClear - Callback when PDF is cleared: () => void

  const [pdfDoc, setPdfDoc] = createSignal(null);
  const [currentPage, setCurrentPage] = createSignal(1);
  const [totalPages, setTotalPages] = createSignal(0);
  const [scale, setScale] = createSignal(1.0);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(null);
  const [pdfSource, setPdfSource] = createSignal(null); // URL or ArrayBuffer
  const [fileName, setFileName] = createSignal(null);
  const [libReady, setLibReady] = createSignal(false);
  const [rendering, setRendering] = createSignal(false);

  let canvasRef;
  let containerRef;
  let fileInputRef;
  let currentRenderTask = null;
  let pendingRender = null;
  let blobUrl = null; // Track blob URL for cleanup
  let resizeObserver = null;

  // Initialize PDF.js on mount
  onMount(async () => {
    try {
      await initPdfJs();
      setLibReady(true);
    } catch (err) {
      console.error('Failed to initialize PDF.js:', err);
      setError('Failed to initialize PDF viewer');
    }

    // Watch for container resize (e.g., when panel becomes visible)
    resizeObserver = new ResizeObserver(() => {
      const doc = pdfDoc();
      if (doc && canvasRef) {
        // Re-render when container size changes
        scheduleRender(currentPage());
      }
    });

    if (containerRef) {
      resizeObserver.observe(containerRef);
    }
  });

  // Load saved PDF data when provided via props
  createEffect(() => {
    const ready = libReady();
    const savedData = props.pdfData;
    const savedName = props.pdfFileName;

    if (ready && savedData && !pdfSource()) {
      // Clone the ArrayBuffer to avoid detached buffer issues
      // This can happen when the buffer is retrieved from IndexedDB
      const clonedData = savedData.slice(0);
      setFileName(savedName || 'document.pdf');
      setPdfSource({ data: clonedData });
    }
  });

  // Load PDF when source changes and library is ready
  createEffect(() => {
    const source = pdfSource();
    const ready = libReady();
    if (source && ready) {
      loadPdf(source);
    }
  });

  // Render page when page number or scale changes
  createEffect(() => {
    const doc = pdfDoc();
    const page = currentPage();
    const s = scale();
    if (doc && page) {
      // Schedule render for next frame to ensure canvas is mounted
      scheduleRender(page);
    }
  });

  // Schedule a render, waiting for canvas to be available
  function scheduleRender(pageNum) {
    if (pendingRender) {
      cancelAnimationFrame(pendingRender);
    }

    pendingRender = requestAnimationFrame(() => {
      pendingRender = null;
      if (canvasRef) {
        renderPage(pageNum);
      } else {
        // Canvas not ready yet, try again
        scheduleRender(pageNum);
      }
    });
  }

  async function loadPdf(source) {
    if (!pdfjsLib) return;

    setLoading(true);
    setError(null);

    // Cancel any ongoing render
    if (currentRenderTask) {
      currentRenderTask.cancel();
      currentRenderTask = null;
    }

    try {
      const loadingTask = pdfjsLib.getDocument(source);
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('Failed to load PDF. Please try another file.');
      setPdfDoc(null);
    } finally {
      setLoading(false);
    }
  }

  async function renderPage(pageNum) {
    const doc = pdfDoc();
    if (!doc || !canvasRef) return;

    // Cancel any ongoing render
    if (currentRenderTask) {
      try {
        currentRenderTask.cancel();
      } catch {
        // Ignore cancel errors
      }
      currentRenderTask = null;
    }

    setRendering(true);

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale() });

      const canvas = canvasRef;
      const context = canvas.getContext('2d');

      // Set canvas dimensions before rendering
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      currentRenderTask = page.render(renderContext);
      await currentRenderTask.promise;
      currentRenderTask = null;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
      }
    } finally {
      setRendering(false);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    // Cleanup old blob URL if exists
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = null;
    }

    try {
      // Read file as ArrayBuffer for storage
      const arrayBuffer = await file.arrayBuffer();

      // Set the source to load PDF
      setFileName(file.name);
      setPdfSource({ data: arrayBuffer });

      // Notify parent of change for persistence
      if (props.onPdfChange) {
        props.onPdfChange(arrayBuffer, file.name);
      }
    } catch (err) {
      console.error('Error reading PDF file:', err);
      setError('Failed to read PDF file');
    }

    // Reset the input so same file can be re-selected
    event.target.value = '';
  }

  function clearPdf() {
    // Cleanup blob URL if exists
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = null;
    }

    setPdfDoc(null);
    setPdfSource(null);
    setFileName(null);
    setCurrentPage(1);
    setTotalPages(0);
    setError(null);

    // Notify parent
    if (props.onPdfClear) {
      props.onPdfClear();
    }
  }

  function goToPrevPage() {
    if (currentPage() > 1) {
      setCurrentPage(currentPage() - 1);
    }
  }

  function goToNextPage() {
    if (currentPage() < totalPages()) {
      setCurrentPage(currentPage() + 1);
    }
  }

  function zoomIn() {
    setScale(Math.min(scale() + 0.25, 3.0));
  }

  function zoomOut() {
    setScale(Math.max(scale() - 0.25, 0.5));
  }

  function resetZoom() {
    setScale(1.0);
  }

  function fitToWidth() {
    if (!containerRef || !pdfDoc()) return;

    pdfDoc()
      .getPage(currentPage())
      .then(page => {
        const viewport = page.getViewport({ scale: 1.0 });
        const containerWidth = containerRef.clientWidth - 32; // Account for padding
        const newScale = containerWidth / viewport.width;
        setScale(Math.min(newScale, 3.0));
      });
  }

  // Cleanup blob URLs and pending renders
  onCleanup(() => {
    if (pendingRender) {
      cancelAnimationFrame(pendingRender);
    }
    if (currentRenderTask) {
      try {
        currentRenderTask.cancel();
      } catch {
        // Ignore
      }
    }
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  return (
    <div class='flex flex-col h-full bg-gray-100' ref={containerRef}>
      {/* Toolbar */}
      <div class='bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4 shrink-0'>
        {/* File upload and info */}
        <div class='flex items-center gap-2 min-w-0'>
          <input
            ref={fileInputRef}
            type='file'
            accept='application/pdf'
            onChange={handleFileUpload}
            class='hidden'
          />
          <button
            onClick={() => fileInputRef?.click()}
            disabled={!libReady()}
            class='inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shrink-0'
          >
            <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12'
              />
            </svg>
            {pdfDoc() ? 'Change' : 'Open PDF'}
          </button>

          {/* Show file name if PDF is loaded */}
          <Show when={fileName()}>
            <span class='text-sm text-gray-600 truncate max-w-40' title={fileName()}>
              {fileName()}
            </span>
            <button
              onClick={clearPdf}
              class='p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0'
              title='Clear PDF'
            >
              <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </Show>
        </div>

        {/* Page navigation */}
        <Show when={pdfDoc()}>
          <div class='flex items-center gap-2'>
            <button
              onClick={goToPrevPage}
              disabled={currentPage() <= 1}
              class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              title='Previous page'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M15 19l-7-7 7-7'
                />
              </svg>
            </button>
            <span class='text-sm text-gray-600 min-w-20 text-center'>
              {currentPage()} / {totalPages()}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage() >= totalPages()}
              class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              title='Next page'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M9 5l7 7-7 7'
                />
              </svg>
            </button>
          </div>

          {/* Zoom controls */}
          <div class='flex items-center gap-1'>
            <button
              onClick={zoomOut}
              disabled={scale() <= 0.5}
              class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              title='Zoom out'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M20 12H4'
                />
              </svg>
            </button>
            <button
              onClick={resetZoom}
              class='px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors min-w-[50px]'
              title='Reset zoom'
            >
              {Math.round(scale() * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={scale() >= 3.0}
              class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              title='Zoom in'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M12 4v16m8-8H4'
                />
              </svg>
            </button>
            <button
              onClick={fitToWidth}
              class='p-1.5 rounded hover:bg-gray-100 transition-colors'
              title='Fit to width'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4'
                />
              </svg>
            </button>
          </div>
        </Show>
      </div>

      {/* PDF Content */}
      <div class='flex-1 overflow-auto p-4'>
        <Show when={!libReady()}>
          <div class='flex items-center justify-center h-full'>
            <div class='flex items-center gap-3 text-gray-500'>
              <div class='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
              Initializing PDF viewer...
            </div>
          </div>
        </Show>

        <Show when={libReady() && loading()}>
          <div class='flex items-center justify-center h-full'>
            <div class='flex items-center gap-3 text-gray-500'>
              <div class='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
              Loading PDF...
            </div>
          </div>
        </Show>

        <Show when={libReady() && error()}>
          <div class='flex items-center justify-center h-full'>
            <div class='text-center'>
              <div class='text-red-600 mb-2'>{error()}</div>
              <button
                onClick={() => fileInputRef?.click()}
                class='text-blue-600 hover:text-blue-700 font-medium'
              >
                Try another file
              </button>
            </div>
          </div>
        </Show>

        <Show when={libReady() && !loading() && !error() && !pdfDoc()}>
          <div class='flex flex-col items-center justify-center h-full text-gray-500'>
            <svg
              class='w-16 h-16 mb-4 text-gray-300'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='1.5'
                d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
              />
            </svg>
            <p class='mb-2'>No PDF loaded</p>
            <button
              onClick={() => fileInputRef?.click()}
              class='text-blue-600 hover:text-blue-700 font-medium'
            >
              Open a PDF file
            </button>
          </div>
        </Show>

        <Show when={libReady() && !loading() && !error() && pdfDoc()}>
          <div class='flex justify-center relative'>
            <Show when={rendering()}>
              <div class='absolute inset-0 flex items-center justify-center bg-white/50'>
                <div class='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
              </div>
            </Show>
            <canvas
              ref={canvasRef}
              class='shadow-lg bg-white'
              style={{ 'max-width': '100%', height: 'auto' }}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}
