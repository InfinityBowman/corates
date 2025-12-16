/**
 * usePdfJs - Primitive for PDF.js library initialization and PDF document management
 * Handles lazy loading of PDF.js, document loading, page rendering with continuous scroll
 */

import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { initPdfJs } from '@/lib/pdfUtils.js';

// Local reference to pdfjsLib after initialization
let pdfjsLib = null;

/**
 * Hook for managing PDF.js document state with continuous scrolling support
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
  const [pageCanvases, setPageCanvases] = createSignal([]);
  const [pageTextLayers, setPageTextLayers] = createSignal([]);

  let currentRenderTasks = new Map(); // Track render tasks per page
  let renderingPages = new Set(); // Track which pages are currently rendering
  let pendingRenders = new Map(); // Track pending render requests per page
  let blobUrl = null;
  let containerRef = null;
  let scrollContainerRef = null;
  let fileInputRef = null;
  let resizeObserver = null;
  let userCleared = false; // Track if user explicitly cleared the PDF
  let pageRefs = new Map(); // Store refs to page containers for scroll detection
  let loadingSourceId = null; // Track currently loading source to prevent duplicate loads

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
      if (doc) {
        // Re-render all visible pages when container size changes
        renderAllPages();
      }
    });

    if (containerRef) {
      resizeObserver.observe(containerRef);
    }
  }

  // Set scroll container ref and setup scroll listener
  function setScrollContainerRef(ref) {
    scrollContainerRef = ref;
    if (ref) {
      ref.addEventListener('scroll', handleScroll);
    }
  }

  // Handle scroll to update current page indicator
  function handleScroll() {
    if (!scrollContainerRef || pageRefs.size === 0) return;

    const containerRect = scrollContainerRef.getBoundingClientRect();
    const containerMiddle = containerRect.top + containerRect.height / 2;

    let closestPage = 1;
    let closestDistance = Infinity;

    pageRefs.forEach((pageEl, pageNum) => {
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        const pageMiddle = pageRect.top + pageRect.height / 2;
        const distance = Math.abs(pageMiddle - containerMiddle);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = pageNum;
        }
      }
    });

    if (closestPage !== currentPage()) {
      setCurrentPage(closestPage);
    }
  }

  // Register a page container ref
  function setPageRef(pageNum, ref) {
    if (ref) {
      pageRefs.set(pageNum, ref);
    } else {
      pageRefs.delete(pageNum);
    }
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

    // Don't reload from props if user explicitly cleared the PDF
    if (ready && savedData && !pdfSource() && !userCleared) {
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

  // Track previous scale to detect changes
  let prevScale = null;
  // Track which pages have been rendered
  let renderedPages = new Set();

  // Re-render all pages when scale changes
  createEffect(() => {
    const doc = pdfDoc();
    const currentScale = scale();
    if (doc && prevScale !== null && prevScale !== currentScale) {
      renderedPages.clear(); // Clear rendered tracking on scale change
      renderAllPages();
    }
    prevScale = currentScale;
  });

  // Render newly mounted canvases
  createEffect(() => {
    const doc = pdfDoc();
    const canvases = pageCanvases();
    const currentScale = scale();

    if (!doc) {
      renderedPages.clear();
      return;
    }

    // Find canvases that exist but haven't been rendered
    const pagesToRender = [];
    for (let i = 0; i < canvases.length; i++) {
      if (canvases[i] && !renderedPages.has(i + 1)) {
        pagesToRender.push(i + 1);
      }
    }

    if (pagesToRender.length > 0) {
      // Mark pages as being rendered to avoid duplicate renders
      pagesToRender.forEach(p => renderedPages.add(p));

      // Render the new pages sequentially
      (async () => {
        for (const pageNum of pagesToRender) {
          await renderPage(pageNum, currentScale);
        }
      })();
    }
  });

  async function loadPdf(source) {
    if (!pdfjsLib) return;

    // Generate a unique ID for this source to prevent duplicate loads
    const sourceId = source.data ? source.data.byteLength : JSON.stringify(source);

    // Skip if we're already loading this exact source
    if (loadingSourceId === sourceId) {
      return;
    }
    loadingSourceId = sourceId;

    setLoading(true);
    setError(null);

    // Clear rendered tracking for new document
    renderedPages.clear();

    // Cancel all pending render tasks
    currentRenderTasks.forEach(task => {
      try {
        task.cancel();
      } catch {
        // Ignore cancel errors
      }
    });
    currentRenderTasks.clear();
    renderingPages.clear();
    pendingRenders.clear();

    // Destroy old PDF document to release resources
    const oldDoc = pdfDoc();
    if (oldDoc) {
      try {
        await oldDoc.destroy();
      } catch {
        // Ignore destroy errors
      }
    }

    try {
      // Clone the ArrayBuffer before passing to PDF.js since it transfers ownership
      // to the web worker, which detaches the original buffer
      let loadSource = source;
      if (source.data && source.data instanceof ArrayBuffer && source.data.byteLength > 0) {
        loadSource = { ...source, data: source.data.slice(0) };
      }

      // verbosity: 0 = ERRORS only (suppress warnings about malformed PDFs)
      const loadingTask = pdfjsLib.getDocument({ ...loadSource, verbosity: 0 });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);

      // Initialize canvas and text layer refs arrays - the effect watching pageCanvases
      // will render pages as canvases are mounted in the DOM
      setPageCanvases(Array(pdf.numPages).fill(null));
      setPageTextLayers(Array(pdf.numPages).fill(null));
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('Failed to load PDF. Please try another file.');
      setPdfDoc(null);
    } finally {
      setLoading(false);
      loadingSourceId = null;
    }
  }

  async function renderAllPages() {
    const doc = pdfDoc();
    if (!doc) return;

    setRendering(true);

    try {
      const numPages = doc.numPages;
      const currentScale = scale();

      // Clear and re-add to renderedPages tracking
      renderedPages.clear();

      // Render pages sequentially to avoid canvas conflicts
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        // Only render if canvas exists
        const canvases = pageCanvases();
        if (canvases[pageNum - 1]) {
          renderedPages.add(pageNum);
          await renderPage(pageNum, currentScale);
        }
      }
    } finally {
      setRendering(false);
    }
  }

  async function renderPage(pageNum, scaleValue) {
    const doc = pdfDoc();
    const canvases = pageCanvases();
    const canvas = canvases[pageNum - 1];

    if (!doc || !canvas) return;

    // If this page is already rendering, queue the request
    if (renderingPages.has(pageNum)) {
      pendingRenders.set(pageNum, scaleValue);
      return;
    }

    // Mark page as rendering
    renderingPages.add(pageNum);

    // Cancel any existing render task for this page
    if (currentRenderTasks.has(pageNum)) {
      try {
        const task = currentRenderTasks.get(pageNum);
        task.cancel();
        await task.promise.catch(() => {}); // Wait for cancellation
        // Small delay to ensure PDF.js fully releases the canvas
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch {
        // Ignore cancel errors
      }
      currentRenderTasks.delete(pageNum);
    }

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: scaleValue });

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

      const renderTask = page.render(renderContext);
      currentRenderTasks.set(pageNum, renderTask);
      await renderTask.promise;
      currentRenderTasks.delete(pageNum);

      // Render text layer for text selection
      const textLayers = pageTextLayers();
      const textLayerDiv = textLayers[pageNum - 1];
      if (textLayerDiv && pdfjsLib.TextLayer) {
        // Clear existing text layer content
        textLayerDiv.innerHTML = '';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
        });
        await textLayer.render();
      }
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', pageNum, err);
      }
    } finally {
      renderingPages.delete(pageNum);

      // Check if there's a pending render for this page
      if (pendingRenders.has(pageNum)) {
        const pendingScale = pendingRenders.get(pageNum);
        pendingRenders.delete(pageNum);
        // Schedule the pending render
        renderPage(pageNum, pendingScale);
      }
    }
  }

  // Set canvas ref for a specific page
  function setPageCanvasRef(pageNum, ref) {
    setPageCanvases(prev => {
      const newCanvases = [...prev];
      newCanvases[pageNum - 1] = ref;
      return newCanvases;
    });

    // Don't automatically render here - let renderAllPages handle initial render
    // to avoid race conditions with multiple canvases mounting simultaneously
  }

  // Set text layer ref for a specific page
  function setPageTextLayerRef(pageNum, ref) {
    setPageTextLayers(prev => {
      const newLayers = [...prev];
      newLayers[pageNum - 1] = ref;
      return newLayers;
    });
  }

  async function handleFile(file) {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = null;
    }

    // Reset userCleared flag since user is uploading a new file
    userCleared = false;

    try {
      const arrayBuffer = await file.arrayBuffer();
      setFileName(file.name);
      // Clone the buffer for internal use since PDF.js will detach it
      setPdfSource({ data: arrayBuffer.slice(0) });

      if (options.onPdfChange) {
        // Clone again for the callback so parent has a usable copy
        options.onPdfChange(arrayBuffer.slice(0), file.name);
      }
    } catch (err) {
      console.error('Error reading PDF file:', err);
      setError('Failed to read PDF file');
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    await handleFile(file);
    event.target.value = '';
  }

  function clearPdf() {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = null;
    }

    // Cancel any pending render tasks
    currentRenderTasks.forEach(task => {
      try {
        task.cancel();
      } catch {
        // Ignore
      }
    });
    currentRenderTasks.clear();
    renderingPages.clear();
    pendingRenders.clear();

    // Destroy the PDF document to release resources
    const doc = pdfDoc();
    if (doc) {
      doc.destroy().catch(() => {
        // Ignore destroy errors
      });
    }

    // Clear all canvases
    pageCanvases().forEach(canvas => {
      if (canvas) {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      }
    });

    // Mark as user-cleared to prevent auto-reload from props
    userCleared = true;

    setPdfDoc(null);
    setPdfSource(null);
    setFileName(null);
    setCurrentPage(1);
    setTotalPages(0);
    setPageCanvases([]);
    setPageTextLayers([]);
    setError(null);
    pageRefs.clear();
    renderedPages.clear();

    if (options.onPdfClear) {
      options.onPdfClear();
    }
  }

  function openFilePicker() {
    fileInputRef?.click();
  }

  // Navigation - scroll to page
  function goToPage(pageNum) {
    const pageEl = pageRefs.get(pageNum);
    if (pageEl && scrollContainerRef) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageNum);
    }
  }

  function goToPrevPage() {
    if (currentPage() > 1) {
      goToPage(currentPage() - 1);
    }
  }

  function goToNextPage() {
    if (currentPage() < totalPages()) {
      goToPage(currentPage() + 1);
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
      .getPage(1)
      .then(page => {
        const viewport = page.getViewport({ scale: 1.0 });
        const containerWidth = containerRef.clientWidth - 64; // Account for padding
        const newScale = containerWidth / viewport.width;
        setScale(Math.min(Math.max(newScale, 0.5), 3.0));
      });
  }

  // Cleanup
  onCleanup(() => {
    // Cancel all pending render tasks
    currentRenderTasks.forEach(task => {
      try {
        task.cancel();
      } catch {
        // Ignore
      }
    });
    currentRenderTasks.clear();
    renderingPages.clear();
    pendingRenders.clear();

    // Destroy the PDF document to release resources and clean up internal canvases
    const doc = pdfDoc();
    if (doc) {
      doc.destroy().catch(() => {
        // Ignore destroy errors
      });
    }

    // Clear all canvas refs
    pageCanvases().forEach(canvas => {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      }
    });

    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (scrollContainerRef) {
      scrollContainerRef.removeEventListener('scroll', handleScroll);
    }

    // Clear refs
    pageRefs.clear();
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
    pageCanvases,

    // Ref setters
    setPageCanvasRef,
    setPageTextLayerRef,
    setPageRef,
    setFileInputRef,
    setScrollContainerRef,
    setupResizeObserver,

    // Actions
    handleFile,
    handleFileUpload,
    clearPdf,
    openFilePicker,
    goToPage,
    goToPrevPage,
    goToNextPage,
    zoomIn,
    zoomOut,
    resetZoom,
    setScale,
    fitToWidth,
  };
}
