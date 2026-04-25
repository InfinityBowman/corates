/**
 * Shared study display utilities for sorting PDFs and building citation lines.
 * Used by TodoStudyRow, CompletedStudyRow, and ReconcileStudyRow.
 */

import type { PdfEntry, StudyInfo } from '@/stores/projectStore';

const TAG_ORDER: Record<string, number> = { primary: 0, protocol: 1, secondary: 2 };

export function sortStudyPdfs(pdfs: PdfEntry[]): PdfEntry[] {
  return [...pdfs].sort((a, b) => {
    const aOrder = TAG_ORDER[a.tag] ?? 2;
    const bOrder = TAG_ORDER[b.tag] ?? 2;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.uploadedAt - a.uploadedAt;
  });
}

export function getCitationLine(sortedPdfs: PdfEntry[], study: StudyInfo): string | null {
  const primaryPdf = sortedPdfs.find(p => p.tag === 'primary') || sortedPdfs[0];
  const author = primaryPdf?.firstAuthor || study.firstAuthor;
  const year = primaryPdf?.publicationYear || study.publicationYear;
  if (!author && !year) return null;
  return `${author || 'Unknown'}${year ? ` (${year})` : ''}`;
}
