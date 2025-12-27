/**
 * pdfDocument - PDF document loading and state management
 * Handles PDF.js library initialization, document loading/unloading, and document state
 */

import { createSignal, createEffect, onMount } from 'solid-js'
import { initPdfJs } from '@/lib/pdfUtils.js'

// Local reference to pdfjsLib after initialization
let pdfjsLib = null

/**
 * Creates PDF document management module
 * @returns {Object} Document state and operations
 */
export function createPdfDocument() {
  const [pdfDoc, setPdfDoc] = createSignal(null)
  const [totalPages, setTotalPages] = createSignal(0)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal(null)
  const [pdfSource, setPdfSource] = createSignal(null)
  const [fileName, setFileName] = createSignal(null)
  const [libReady, setLibReady] = createSignal(false)
  const [docId, setDocId] = createSignal(0)

  let loadingSourceId = null
  let userCleared = false

  // Initialize PDF.js on mount
  onMount(async () => {
    try {
      pdfjsLib = await initPdfJs()
      setLibReady(true)
    } catch (err) {
      console.error('Failed to initialize PDF.js:', err)
      setError('Failed to initialize PDF viewer')
    }
  })

  // Store callback for before load
  let onBeforeLoadCallback = null

  function setOnBeforeLoad(callback) {
    onBeforeLoadCallback = callback
  }

  // Load PDF when source changes and library is ready
  createEffect(() => {
    const source = pdfSource()
    const ready = libReady()
    if (source && ready) {
      loadPdf(source, onBeforeLoadCallback)
    }
  })

  async function loadPdf(source, onBeforeLoad = null) {
    if (!pdfjsLib) return

    // Generate a unique ID for this source to prevent duplicate loads
    const sourceId = source.data
      ? source.data.byteLength
      : JSON.stringify(source)

    // Skip if we're already loading this exact source
    if (loadingSourceId === sourceId) {
      return
    }
    loadingSourceId = sourceId

    setLoading(true)
    setError(null)

    // Destroy old PDF document to release resources
    const oldDoc = pdfDoc()
    if (oldDoc) {
      try {
        await oldDoc.destroy()
      } catch {
        // Ignore destroy errors
      }
    }

    // Call callback before loading to allow clearing canvases
    if (onBeforeLoad) {
      onBeforeLoad()
    }

    try {
      // Clone the ArrayBuffer before passing to PDF.js since it transfers ownership
      // to the web worker, which detaches the original buffer
      let loadSource = source
      if (
        source.data &&
        source.data instanceof ArrayBuffer &&
        source.data.byteLength > 0
      ) {
        loadSource = { ...source, data: source.data.slice(0) }
      }

      // verbosity: 0 = ERRORS only (suppress warnings about malformed PDFs)
      const loadingTask = pdfjsLib.getDocument({ ...loadSource, verbosity: 0 })
      const pdf = await loadingTask.promise

      // Increment docId to force DOM recreation of canvas elements
      setDocId((id) => id + 1)

      setPdfDoc(pdf)
      setTotalPages(pdf.numPages)
    } catch (err) {
      console.error('Error loading PDF:', err)
      setError('Failed to load PDF. Please try another file.')
      setPdfDoc(null)
    } finally {
      setLoading(false)
      loadingSourceId = null
    }
  }

  function clearPdf() {
    // Destroy the PDF document to release resources
    const doc = pdfDoc()
    if (doc) {
      doc.destroy().catch(() => {
        // Ignore destroy errors
      })
    }

    // Mark as user-cleared to prevent auto-reload from props
    userCleared = true

    setPdfDoc(null)
    setPdfSource(null)
    setFileName(null)
    setTotalPages(0)
    setError(null)
  }

  function setPdfSourceAndName(source, name) {
    userCleared = false
    setFileName(name)
    setPdfSource(source)
  }

  return {
    // State
    pdfDoc,
    totalPages,
    loading,
    error,
    fileName,
    libReady,
    docId,
    pdfSource,
    userCleared: () => userCleared,

    // Actions
    loadPdf,
    clearPdf,
    setPdfSourceAndName,
    setFileName,
    setError,
    setOnBeforeLoad,

    // Library access
    getPdfJsLib: () => pdfjsLib,
  }
}
