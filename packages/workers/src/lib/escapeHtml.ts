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
