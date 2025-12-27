/**
 * usePdfJs - Main hook that composes PDF modules
 * Coordinates between pdfDocument, pdfRenderer, pdfScrollHandler, and pdfFileHandler
 */

import { createSignal, createEffect, onCleanup } from 'solid-js'
import { createPdfDocument } from './pdfDocument.js'
import { createPdfRenderer } from './pdfRenderer.js'
import { createPdfScrollHandler } from './pdfScrollHandler.js'
import { createPdfFileHandler } from './pdfFileHandler.js'

/**
 * Hook for managing PDF.js document state with continuous scrolling support
 * @param {Object} options
 * @param {() => ArrayBuffer|null} options.pdfData - Accessor for PDF data from props
 * @param {() => string|null} options.pdfFileName - Accessor for PDF file name from props
 * @param {(data: ArrayBuffer, fileName: string) => void} options.onPdfChange - Callback when PDF changes
 * @param {() => void} options.onPdfClear - Callback when PDF is cleared
 */
export default function usePdfJs(options = {}) {
  // Create modules
  const document = createPdfDocument()
  const scrollHandler = createPdfScrollHandler(document)
  const renderer = createPdfRenderer(document, scrollHandler)
  const fileHandler = createPdfFileHandler(document, {
    onPdfChange: options.onPdfChange,
    onPdfClear: options.onPdfClear,
  })

  // Connect renderer to scroll handler for IntersectionObserver callbacks
  scrollHandler.setRendererCallbacks({
    schedulePageRender: (pageNum) => renderer.schedulePageRender(pageNum),
    cancelPageRender: (pageNum) => renderer.cancelPageRender(pageNum),
  })

  // Setup callback to clear canvases before loading new PDF
  document.setOnBeforeLoad(() => {
    renderer.clearAllCanvases()
    renderer.cancelAllRenders()
  })

  // Track currently loaded filename to detect when props change to a different PDF
  const [loadedPdfName, setLoadedPdfName] = createSignal(null)

  // Load saved PDF data when provided via props
  // NOTE: We intentionally do NOT clear state when props become null.
  // This allows the old PDF to stay visible during transitions while the new one loads.
  // Clearing is only done via explicit clearPdf() call (e.g., for local checklist deletion).
  createEffect(() => {
    const ready = document.libReady()
    const savedData = options.pdfData?.()
    const savedName = options.pdfFileName?.()

    // Only proceed if we have data and a name
    if (!ready || !savedData || !savedName) return

    // Skip if we've already loaded this exact file
    if (loadedPdfName() === savedName) return

    // If user cleared but now we have a DIFFERENT file, accept it
    // (This handles the case where parent sends new data after clear)
    if (document.userCleared()) {
      // Reset userCleared flag in document module
      // We'll handle this by setting the source directly
    }

    // Load the new PDF (old one stays visible until this completes)
    const clonedData = savedData.slice(0)
    setLoadedPdfName(savedName)
    document.setPdfSourceAndName({ data: clonedData }, savedName)
  })

  // Initialize canvas arrays when PDF loads
  createEffect(() => {
    const doc = document.pdfDoc()
    const totalPages = document.totalPages()
    const docId = document.docId()
    if (doc && totalPages > 0 && docId > 0) {
      renderer.initializeCanvasArrays(totalPages)
      scrollHandler.setCurrentPage(1)
    }
  })

  // Clear rendered tracking when PDF changes
  createEffect(() => {
    const docId = document.docId()
    if (docId > 0) {
      renderer.clearRenderedTracking()
      renderer.clearAllCanvases()
    }
  })

  // Cleanup
  onCleanup(() => {
    renderer.cleanup()
    scrollHandler.cleanup()
    renderer.cancelAllRenders()
  })

  return {
    // State
    pdfDoc: document.pdfDoc,
    currentPage: scrollHandler.currentPage,
    totalPages: document.totalPages,
    scale: scrollHandler.scale,
    loading: document.loading,
    error: document.error,
    fileName: document.fileName,
    libReady: document.libReady,
    rendering: renderer.rendering,
    pageCanvases: renderer.pageCanvases,
    docId: document.docId,

    // Ref setters
    setPageCanvasRef: renderer.setPageCanvasRef,
    setPageTextLayerRef: renderer.setPageTextLayerRef,
    setPageRef: scrollHandler.setPageRef,
    setFileInputRef: fileHandler.setFileInputRef,
    setScrollContainerRef: scrollHandler.setScrollContainerRef,
    setupResizeObserver: renderer.setupResizeObserver,

    // Actions
    handleFile: fileHandler.handleFile,
    handleFileUpload: fileHandler.handleFileUpload,
    clearPdf: fileHandler.clearPdf,
    openFilePicker: fileHandler.openFilePicker,
    goToPage: scrollHandler.goToPage,
    goToPrevPage: scrollHandler.goToPrevPage,
    goToNextPage: scrollHandler.goToNextPage,
    zoomIn: scrollHandler.zoomIn,
    zoomOut: scrollHandler.zoomOut,
    resetZoom: scrollHandler.resetZoom,
    setScale: scrollHandler.setScale,
    fitToWidth: scrollHandler.fitToWidth,
  }
}
