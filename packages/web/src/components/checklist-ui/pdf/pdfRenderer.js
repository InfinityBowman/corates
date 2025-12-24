/**
 * pdfRenderer - Page rendering logic, render queue, and canvas management
 * Handles page rendering, render task management, canvas/text layer refs, and scale changes
 */

import { createSignal, createEffect } from 'solid-js';

/**
 * Creates PDF rendering module
 * @param {Object} document - PDF document module
 * @param {Object} scrollHandler - Scroll handler module
 * @returns {Object} Rendering operations
 */
export function createPdfRenderer(document, scrollHandler) {
  const [rendering, setRendering] = createSignal(false);
  const [pageCanvases, setPageCanvases] = createSignal([]);
  const [pageTextLayers, setPageTextLayers] = createSignal([]);

  let currentRenderTasks = new Map();
  let renderingPages = new Set();
  let pendingRenders = new Map();
  let renderedPages = new Set();
  let containerRef = null;
  let resizeObserver = null;
  let resizeRafId = null;
  let prevScale = null;
  let prevContainerWidth = null;
  let prevContainerHeight = null;

  const RENDER_CONCURRENCY = 3; // Limit concurrent renders to avoid overwhelming GPU
  const CANVAS_CLEAR_DELAY = 5000; // Clear canvas 5 seconds after page leaves viewport
  const canvasClearTimeouts = new Map(); // Track timeouts for clearing canvases
  const RESIZE_THRESHOLD = 50; // Only re-render if container size changes by more than 50px

  // Setup resize observer
  // Note: We don't re-render on resize to avoid white flashes.
  // The canvas maintains its pixel dimensions and scales with CSS.
  // Re-rendering only happens when scale explicitly changes (zoom) or PDF changes.
  function setupResizeObserver(container) {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }

    containerRef = container;

    // ResizeObserver is kept for potential future use (e.g., fit-to-width on resize)
    // But we don't trigger re-renders here to prevent white flashes
    resizeObserver = new ResizeObserver(() => {
      // No-op: We don't re-render on resize to prevent white flashes
      // The canvas will scale with CSS transforms
    });

    if (containerRef) {
      resizeObserver.observe(containerRef);
    }
  }

  // Re-render visible pages when scale changes
  createEffect(() => {
    const doc = document.pdfDoc();
    const currentScale = scrollHandler.scale();
    if (doc && prevScale !== null && prevScale !== currentScale) {
      // Clear rendered tracking for visible pages
      const visiblePages = scrollHandler.getVisiblePages ? scrollHandler.getVisiblePages() : new Set();
      if (visiblePages.size > 0) {
        visiblePages.forEach(pageNum => renderedPages.delete(pageNum));
      } else {
        renderedPages.clear();
      }
      renderAllPages();
    }
    prevScale = currentScale;
  });

  // Render newly mounted canvases - only render visible pages
  createEffect(() => {
    const doc = document.pdfDoc();
    const canvases = pageCanvases();
    const currentScale = scrollHandler.scale();
    // Track docId to re-run this effect when PDF changes
    document.docId();

    if (!doc) {
      renderedPages.clear();
      return;
    }

    // Get visible pages from scroll handler
    const visiblePages = scrollHandler.getVisiblePages ? scrollHandler.getVisiblePages() : new Set();

    // Find canvases that exist but haven't been rendered
    // Only render if page is visible or if no visibility tracking is available (fallback)
    const pagesToRender = [];
    for (let i = 0; i < canvases.length; i++) {
      const pageNum = i + 1;
      if (canvases[i] && !renderedPages.has(pageNum)) {
        // Only render visible pages, or all pages if visibility tracking not available
        if (visiblePages.size === 0 || visiblePages.has(pageNum)) {
          pagesToRender.push(pageNum);
        }
      }
    }

    if (pagesToRender.length > 0) {
      // Mark pages as being rendered to avoid duplicate renders
      pagesToRender.forEach(p => renderedPages.add(p));

      // Capture scale for async callback
      const capturedScale = currentScale;

      // Use queueMicrotask to ensure DOM is fully updated before rendering
      // Render with priority: visible pages first
      queueMicrotask(() => renderWithPriority(pagesToRender, capturedScale));
    }
  });

  // Schedule a page render (called by IntersectionObserver)
  function schedulePageRender(pageNum) {
    const doc = document.pdfDoc();
    const canvases = pageCanvases();
    const canvas = canvases[pageNum - 1];

    if (!doc || !canvas) return;

    // Cancel any pending canvas clear timeout
    if (canvasClearTimeouts.has(pageNum)) {
      clearTimeout(canvasClearTimeouts.get(pageNum));
      canvasClearTimeouts.delete(pageNum);
    }

    // Only render if not already rendered or if canvas was cleared
    if (!renderedPages.has(pageNum) || canvas.width === 0) {
      const currentScale = scrollHandler.scale();
      renderedPages.add(pageNum);
      queueMicrotask(() => renderPage(pageNum, currentScale));
    }
  }

  // Cancel a page render (called by IntersectionObserver)
  function cancelPageRender(pageNum) {
    if (currentRenderTasks.has(pageNum)) {
      try {
        const task = currentRenderTasks.get(pageNum);
        task.cancel();
        currentRenderTasks.delete(pageNum);
      } catch {
        // Ignore cancel errors
      }
    }
    renderingPages.delete(pageNum);
    pendingRenders.delete(pageNum);
    renderedPages.delete(pageNum);

    // Schedule canvas clearing after delay
    if (canvasClearTimeouts.has(pageNum)) {
      clearTimeout(canvasClearTimeouts.get(pageNum));
    }

    const timeoutId = setTimeout(() => {
      clearPageCanvas(pageNum);
      canvasClearTimeouts.delete(pageNum);
    }, CANVAS_CLEAR_DELAY);

    canvasClearTimeouts.set(pageNum, timeoutId);
  }

  // Clear a single page canvas
  function clearPageCanvas(pageNum) {
    const canvases = pageCanvases();
    const canvas = canvases[pageNum - 1];
    if (canvas) {
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  // Render pages in parallel with priority queue
  async function renderWithPriority(pages, scaleValue) {
    if (pages.length === 0) return;

    // Get visible pages and current page for prioritization
    const visiblePages = scrollHandler.getVisiblePages ? scrollHandler.getVisiblePages() : new Set();
    const currentPageNum = scrollHandler.currentPage ? scrollHandler.currentPage() : 1;

    // Sort by priority: visible first, then by distance from current page
    const prioritized = pages.sort((a, b) => {
      const aVisible = visiblePages.has(a);
      const bVisible = visiblePages.has(b);
      if (aVisible !== bVisible) return aVisible ? -1 : 1;
      return Math.abs(a - currentPageNum) - Math.abs(b - currentPageNum);
    });

    // Process in batches to limit concurrency
    for (let i = 0; i < prioritized.length; i += RENDER_CONCURRENCY) {
      const batch = prioritized.slice(i, i + RENDER_CONCURRENCY);
      await Promise.allSettled(batch.map(pageNum => renderPage(pageNum, scaleValue)));
    }
  }

  async function renderAllPages() {
    const doc = document.pdfDoc();
    if (!doc) return;

    setRendering(true);

    try {
      const numPages = doc.numPages;
      const currentScale = scrollHandler.scale();

      // Get visible pages - only re-render visible pages on resize
      const visiblePages = scrollHandler.getVisiblePages ? scrollHandler.getVisiblePages() : new Set();

      // Clear rendered tracking for visible pages only
      if (visiblePages.size > 0) {
        visiblePages.forEach(pageNum => renderedPages.delete(pageNum));
      } else {
        // Fallback: clear all if visibility tracking not available
        renderedPages.clear();
      }

      // Render pages - prioritize visible pages
      const pagesToRender = [];
      const canvases = pageCanvases();

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (canvases[pageNum - 1]) {
          // Only render visible pages, or all if visibility tracking not available
          if (visiblePages.size === 0 || visiblePages.has(pageNum)) {
            pagesToRender.push(pageNum);
            renderedPages.add(pageNum);
          }
        }
      }

      // Render pages in parallel with priority queue
      await renderWithPriority(pagesToRender, currentScale);
    } finally {
      setRendering(false);
    }
  }

  async function renderPage(pageNum, scaleValue) {
    const doc = document.pdfDoc();
    const canvases = pageCanvases();
    const canvas = canvases[pageNum - 1];
    const pdfjsLib = document.getPdfJsLib();

    if (!doc || !canvas || !pdfjsLib) return;

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
        await task.promise.catch(() => {});
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
      const newWidth = viewport.width * dpr;
      const newHeight = viewport.height * dpr;

      // Only update canvas dimensions if they actually changed
      // This prevents unnecessary clearing during resize
      const dimensionsChanged = canvas.width !== newWidth || canvas.height !== newHeight;

      if (dimensionsChanged) {
        canvas.width = newWidth;
        canvas.height = newHeight;
      }

      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      if (dimensionsChanged) {
        context.scale(dpr, dpr);
        context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      } else {
        // If dimensions haven't changed, we can skip clearing and just re-render
        // This prevents white flash during scale changes when size is the same
        context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      currentRenderTasks.set(pageNum, renderTask);
      await renderTask.promise;
      currentRenderTasks.delete(pageNum);

      // If we preserved old content during resize, it's now been overwritten by the new render
      // No need to do anything - the new render is complete

      // Render text layer for text selection - only for visible pages
      // Defer to requestIdleCallback for low-priority work
      const isVisible = scrollHandler.isPageVisible ? scrollHandler.isPageVisible(pageNum) : true;
      if (isVisible) {
        const textLayers = pageTextLayers();
        const textLayerDiv = textLayers[pageNum - 1];
        if (textLayerDiv && pdfjsLib.TextLayer) {
          // Use requestIdleCallback to defer text layer rendering
          const renderTextLayer = async () => {
            try {
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
            } catch (err) {
              // Ignore errors if page is no longer visible
              if (err.name !== 'RenderingCancelledException') {
                console.error('Error rendering text layer:', pageNum, err);
              }
            }
          };

          // Defer text layer rendering to idle time
          if (window.requestIdleCallback) {
            requestIdleCallback(renderTextLayer, { timeout: 2000 });
          } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(renderTextLayer, 0);
          }
        }
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
  }

  // Set text layer ref for a specific page
  function setPageTextLayerRef(pageNum, ref) {
    setPageTextLayers(prev => {
      const newLayers = [...prev];
      newLayers[pageNum - 1] = ref;
      return newLayers;
    });
  }

  function clearRenderedTracking() {
    renderedPages.clear();
  }

  function cancelAllRenders() {
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
  }

  function clearAllCanvases() {
    pageCanvases().forEach(canvas => {
      if (canvas) {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      }
    });
  }

  function initializeCanvasArrays(numPages) {
    setPageCanvases(Array(numPages).fill(null));
    setPageTextLayers(Array(numPages).fill(null));
  }

  function cleanup() {
    if (resizeRafId !== null) {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = null;
    }

    // Clear all canvas clear timeouts
    canvasClearTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    canvasClearTimeouts.clear();

    cancelAllRenders();

    if (resizeObserver) {
      resizeObserver.disconnect();
    }

    clearAllCanvases();
  }

  return {
    // State
    rendering,
    pageCanvases,

    // Ref setters
    setPageCanvasRef,
    setPageTextLayerRef,
    setupResizeObserver,

    // Rendering
    renderPage,
    renderAllPages,
    schedulePageRender,
    cancelPageRender,
    clearRenderedTracking,
    cancelAllRenders,
    clearAllCanvases,
    initializeCanvasArrays,

    // Cleanup
    cleanup,
  };
}
