import { PdfAnnotationSubtypeName, type PdfAnnotationSubtype } from '@embedpdf/models';

/**
 * EmbedPDF reports an annotation's subtype as a numeric enum (HIGHLIGHT = 9),
 * but the synced `annotations.type` column is a string, so an uncoerced value
 * fails the mutator's args schema and the write is rejected outright.
 */
export function annotationTypeName(type: unknown): string {
  if (typeof type === 'number') {
    return PdfAnnotationSubtypeName[type as PdfAnnotationSubtype] ?? String(type);
  }
  return typeof type === 'string' ? type : '';
}
