import { describe, it, expect } from 'vitest';
import { PdfAnnotationSubtype } from '@embedpdf/models';
import { annotationTypeName } from '@/lib/annotationType';
import { syncApp } from '@corates/shared/sync';

describe('annotationTypeName', () => {
  it('names the numeric subtypes EmbedPDF emits', () => {
    expect(annotationTypeName(PdfAnnotationSubtype.HIGHLIGHT)).toBe('highlight');
    expect(annotationTypeName(PdfAnnotationSubtype.INK)).toBe('ink');
    expect(annotationTypeName(999)).toBe('999');
  });

  it('passes strings through and falls back to empty', () => {
    expect(annotationTypeName('highlight')).toBe('highlight');
    expect(annotationTypeName(undefined)).toBe('');
  });

  it('produces args the annotation mutators accept', () => {
    const base = {
      id: 'a1',
      studyId: 's1',
      checklistId: 'c1',
      pdfId: 'p1',
      type: annotationTypeName(PdfAnnotationSubtype.HIGHLIGHT),
      pageIndex: 0,
      embedPdfData: '{}',
      createdBy: 'u1',
      now: 1_700_000_000_000,
    };

    expect(syncApp.mutators['annotation.add'].args.safeParse(base).success).toBe(true);
    expect(
      syncApp.mutators['annotation.update'].args.safeParse({
        id: base.id,
        updates: { type: base.type, pageIndex: 0, embedPdfData: '{}' },
        now: base.now,
      }).success,
    ).toBe(true);

    // The pre-fix payload: the raw numeric subtype is what the engine rejected.
    expect(
      syncApp.mutators['annotation.add'].args.safeParse({
        ...base,
        type: PdfAnnotationSubtype.HIGHLIGHT,
      }).success,
    ).toBe(false);
  });
});
