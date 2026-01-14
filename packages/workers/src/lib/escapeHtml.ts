const escapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

export function escapeHtml(text: unknown): string {
  if (text == null) return '';
  return String(text).replace(/[&<>"']/g, m => escapeMap[m]);
}

/**
 * Sanitizes a string for use in an email subject line.
 * - Removes control characters and newlines (prevents header injection)
 * - Collapses multiple whitespace into single spaces
 * - Trims leading/trailing whitespace
 * - Truncates to maxLength (default 78 chars per RFC 5322 recommendation)
 */
export function sanitizeEmailSubject(text: unknown, maxLength = 78): string {
  if (text == null) return '';
  return (
    String(text)
      // Remove control characters (0x00-0x1F) and newlines
      .replace(/[\x00-\x1F\x7F]/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength)
  );
}
