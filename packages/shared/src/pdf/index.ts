/**
 * Shared PDF validation constants and utilities
 * Used by both web (frontend) and workers (backend)
 */

/**
 * PDF file limits
 */
export const PDF_LIMITS = {
  /** Maximum file size in bytes (50 MB) */
  MAX_SIZE: 50 * 1024 * 1024,
  /** Maximum filename length in characters */
  MAX_FILENAME_LENGTH: 200,
} as const;

/**
 * PDF magic bytes signature: %PDF-
 * Used to verify file content is actually a PDF
 */
export const PDF_MAGIC_BYTES: readonly number[] = [0x25, 0x50, 0x44, 0x46, 0x2d];

/**
 * Validate filename for PDF uploads
 * Security: Prevents path traversal, injection attacks, and malformed filenames
 *
 * @param fileName - Filename to validate
 * @returns True if valid
 */
export function isValidPdfFilename(fileName: string | null | undefined): boolean {
  if (!fileName) return false;
  if (fileName.length > PDF_LIMITS.MAX_FILENAME_LENGTH) return false;

  // Reject path traversal sequences
  if (fileName.includes('..')) return false;

  // Reject path separators (forward and back slashes)
  if (/[\\/]/.test(fileName)) return false;

  // Reject control characters including null bytes (Unicode category C)
  if (/\p{C}/u.test(fileName)) return false;

  // Reject quotes (can cause issues with Content-Disposition header)
  if (fileName.includes('"')) return false;

  // Must end with .pdf extension (case-insensitive)
  if (!fileName.toLowerCase().endsWith('.pdf')) return false;

  // Reject filenames that are only whitespace before extension
  const nameWithoutExt = fileName.slice(0, -4);
  if (!nameWithoutExt.trim()) return false;

  return true;
}

/**
 * Check if bytes match PDF magic signature (%PDF-)
 *
 * @param bytes - First 5+ bytes of file as Uint8Array or number array
 * @returns True if valid PDF signature
 */
export function isPdfSignature(bytes: Uint8Array | readonly number[]): boolean {
  if (bytes.length < PDF_MAGIC_BYTES.length) return false;
  return PDF_MAGIC_BYTES.every((byte, i) => bytes[i] === byte);
}

/**
 * Format file size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate PDF structure by checking for EOF marker
 * This is a basic structural check to detect truncated/corrupted PDFs
 *
 * @param pdfData - Full PDF data as ArrayBuffer or Uint8Array
 * @returns Validation result with error message if invalid
 */
export function validatePdfStructure(
  pdfData: ArrayBuffer | Uint8Array,
): { valid: true } | { valid: false; error: string } {
  const bytes = pdfData instanceof Uint8Array ? pdfData : new Uint8Array(pdfData);

  // Check magic bytes at start
  if (!isPdfSignature(bytes.slice(0, 5))) {
    return { valid: false, error: 'Not a valid PDF file' };
  }

  // Check for EOF marker at end (basic structural validation)
  // EOF marker should be within the last ~1024 bytes, but we check last 32 for efficiency
  const footerSize = Math.min(32, bytes.length);
  const footer = bytes.slice(-footerSize);
  const footerStr = String.fromCharCode(...footer);
  if (!footerStr.includes('%%EOF')) {
    return { valid: false, error: 'PDF appears to be corrupted (missing EOF marker)' };
  }

  return { valid: true };
}
