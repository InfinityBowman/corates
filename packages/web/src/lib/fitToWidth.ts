/**
 * Shortens text with a trailing ellipsis until `measure` says it fits maxWidth.
 * Shared by renderers that cannot clip on their own (jsPDF, SVG text).
 */
export function fitToWidth(
  text: string,
  maxWidth: number,
  measure: (candidate: string) => number,
): string {
  const fullWidth = measure(text);
  if (fullWidth <= maxWidth) return text;

  // Estimate the cut from the full width, so a long name costs a few measurements, not one per character.
  const keep = Math.max(1, Math.floor((text.length * maxWidth) / fullWidth) - 3);
  let fitted = text.slice(0, keep).trimEnd() + '...';
  while (fitted.length > 4 && measure(fitted) > maxWidth) {
    fitted = fitted.slice(0, -4).trimEnd() + '...';
  }
  return fitted;
}
