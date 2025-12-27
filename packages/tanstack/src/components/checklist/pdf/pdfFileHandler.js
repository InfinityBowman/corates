/**
 * pdfFileHandler - File upload and PDF source management
 * Handles file input, file upload logic, PDF clearing, and blob URL management
 */

/**
 * Creates PDF file handling module
 * @param {Object} document - PDF document module
 * @param {Object} options - Options with callbacks
 * @returns {Object} File handling operations
 */
export function createPdfFileHandler(document, options = {}) {
  let blobUrl = null
  let fileInputRef = null

  async function handleFile(file) {
    if (!file) return

    if (file.type !== 'application/pdf') {
      document.setError('Please select a PDF file')
      return
    }

    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
      blobUrl = null
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      document.setFileName(file.name)
      // Clone the buffer for internal use since PDF.js will detach it
      document.setPdfSourceAndName({ data: arrayBuffer.slice(0) }, file.name)

      if (options.onPdfChange) {
        // Clone again for the callback so parent has a usable copy
        options.onPdfChange(arrayBuffer.slice(0), file.name)
      }
    } catch (err) {
      console.error('Error reading PDF file:', err)
      document.setError('Failed to read PDF file')
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0]
    await handleFile(file)
    event.target.value = ''
  }

  function clearPdf() {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
      blobUrl = null
    }

    document.clearPdf()

    if (options.onPdfClear) {
      options.onPdfClear()
    }
  }

  function openFilePicker() {
    fileInputRef?.click()
  }

  function setFileInputRef(ref) {
    fileInputRef = ref
  }

  return {
    handleFile,
    handleFileUpload,
    clearPdf,
    openFilePicker,
    setFileInputRef,
  }
}
