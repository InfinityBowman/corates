/**
 * PDF validation for frontend
 * Wraps shared utilities and adds File-specific validation logic
 */

import { PDF_LIMITS, isValidPdfFilename, isPdfSignature, formatFileSize } from '@corates/shared';

// Re-export for convenience
export { PDF_LIMITS, formatFileSize };

/**
 * Validate a PDF file before upload
 * Performs client-side validation to reject invalid files before network transfer
 *
 * @param {File} file - File to validate
 * @returns {Promise<{valid: true} | {valid: false, error: string, details: Record<string, unknown>}>}
 */
export async function validatePdfFile(file) {
  // 1. Check file size
  if (file.size > PDF_LIMITS.MAX_SIZE) {
    return {
      valid: false,
      error: 'FILE_TOO_LARGE',
      details: {
        fileSize: file.size,
        maxSize: PDF_LIMITS.MAX_SIZE,
        message: `File size (${formatFileSize(file.size)}) exceeds ${formatFileSize(PDF_LIMITS.MAX_SIZE)} limit`,
      },
    };
  }

  // 2. Check MIME type
  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'INVALID_FILE_TYPE',
      details: {
        fileType: file.type || 'unknown',
        message: 'File must be a PDF document',
      },
    };
  }

  // 3. Check filename
  if (!isValidPdfFilename(file.name)) {
    return {
      valid: false,
      error: 'INVALID_FILENAME',
      details: {
        fileName: file.name,
        message: 'Invalid filename. Avoid special characters and keep under 200 characters.',
      },
    };
  }

  // 4. Check magic bytes
  try {
    const slice = file.slice(0, 5);
    const buffer = await slice.arrayBuffer();
    const header = new Uint8Array(buffer);

    if (!isPdfSignature(header)) {
      return {
        valid: false,
        error: 'INVALID_PDF_SIGNATURE',
        details: {
          message: 'File content does not appear to be a valid PDF',
        },
      };
    }
  } catch (err) {
    // If we can't read the header, let backend validate
    console.warn('Could not validate PDF header:', err);
  }

  return { valid: true };
}
