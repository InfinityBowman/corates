/**
 * usePdfJs - Primitive for PDF.js library initialization and PDF document management
 * Handles lazy loading of PDF.js, document loading, page rendering, and cleanup
 */

import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { initPdfJs } from '@/lib/pdfUtils.js';

// Local reference to pdfjsLib after initialization
let pdfjsLib = null;

/**
 * Hook for managing PDF.js document state
 * @param {Object} options
 * @param {() => ArrayBuffer|null} options.pdfData - Accessor for PDF data from props
 * @param {() => string|null} options.pdfFileName - Accessor for PDF file name from props
 * @param {(data: ArrayBuffer, fileName: string) => void} options.onPdfChange - Callback when PDF changes
 * @param {() => void} options.onPdfClear - Callback when PDF is cleared
 */
export default function usePdfJs(options = {}) {
  const [pdfDoc, setPdfDoc] = createSignal(null);
  const [currentPage, setCurrentPage] = createSignal(1);
  const [totalPages, setTotalPages] = createSignal(0);
  const [scale, setScale] = createSignal(1.0);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(null);
  const [pdfSource, setPdfSource] = createSignal(null);
  const [fileName, setFileName] = createSignal(null);
  const [libReady, setLibReady] = createSignal(false);
  const [rendering, setRendering] = createSignal(false);

  let currentRenderTask = null;
  let pendingRender = null;
  let blobUrl = null;
  let canvasRef = null;
  let containerRef = null;
  let fileInputRef = null;
  let resizeObserver = null;

  // Initialize PDF.js on mount
  onMount(async () => {
    try {
      pdfjsLib = await initPdfJs();
      setLibReady(true);
    } catch (err) {
      console.error('Failed to initialize PDF.js:', err);
      setError('Failed to initialize PDF viewer');
    }
  });

  // Setup resize observer
  function setupResizeObserver(container) {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }

    containerRef = container;

    resizeObserver = new ResizeObserver(() => {
      const doc = pdfDoc();
      if (doc && canvasRef) {
        // Re-render when container size changes
        scheduleRender(currentPage(), scale());
      }
    });

    if (containerRef) {
      resizeObserver.observe(containerRef);
    }
  }

  // Set canvas ref
  function setCanvasRef(ref) {
    canvasRef = ref;
  }

  // Set file input ref
  function setFileInputRef(ref) {
    fileInputRef = ref;
  }

  // Load saved PDF data when provided via props
  createEffect(() => {
    const ready = libReady();
    const savedData = options.pdfData?.();
    const savedName = options.pdfFileName?.();

    if (ready && savedData && !pdfSource()) {
      // Clone the ArrayBuffer to avoid detached buffer issues
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
    const currentScale = scale();
    if (doc && page) {
      scheduleRender(page, currentScale);
    }
  });

  // Schedule a render, waiting for canvas to be available
  function scheduleRender(pageNum, scaleValue) {
    if (pendingRender) {
      cancelAnimationFrame(pendingRender);
    }

    pendingRender = requestAnimationFrame(() => {
      pendingRender = null;
      if (canvasRef) {
        renderPage(pageNum, scaleValue);
      } else {
        scheduleRender(pageNum, scaleValue);
      }
    });
  }

  async function loadPdf(source) {
    if (!pdfjsLib) return;

    setLoading(true);
    setError(null);

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

  async function renderPage(pageNum, scaleValue) {
    const doc = pdfDoc();
    if (!doc || !canvasRef) return;

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
      const viewport = page.getViewport({ scale: scaleValue });

      const canvas = canvasRef;
      const context = canvas.getContext('2d');

      // Account for device pixel ratio for sharp rendering on high-DPI displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.scale(dpr, dpr);
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

    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = null;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      setFileName(file.name);
      setPdfSource({ data: arrayBuffer });

      if (options.onPdfChange) {
        options.onPdfChange(arrayBuffer, file.name);
      }
    } catch (err) {
      console.error('Error reading PDF file:', err);
      setError('Failed to read PDF file');
    }

    event.target.value = '';
  }

  function clearPdf() {
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

    if (options.onPdfClear) {
      options.onPdfClear();
    }
  }

  function openFilePicker() {
    fileInputRef?.click();
  }

  // Navigation
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

  // Zoom controls
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
        const containerWidth = containerRef.clientWidth - 32;
        const newScale = containerWidth / viewport.width;
        setScale(Math.min(newScale, 3.0));
      });
  }

  // Cleanup
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

  return {
    // State
    pdfDoc,
    currentPage,
    totalPages,
    scale,
    loading,
    error,
    fileName,
    libReady,
    rendering,

    // Ref setters
    setCanvasRef,
    setFileInputRef,
    setupResizeObserver,

    // Actions
    handleFileUpload,
    clearPdf,
    openFilePicker,
    goToPrevPage,
    goToNextPage,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToWidth,
  };
}
