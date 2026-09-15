/**
 * Upload one or more picked or dropped PDFs to a study, one at a time so the
 * first file becomes the primary PDF when the study has none yet.
 *
 * In-flight uploads are counted per study so the study sheet can show an
 * uploading state whether the drop landed on the sheet or on the card.
 */

import { create } from 'zustand';
import { showToast } from '@/lib/toast';
import { validatePdfFile } from '@/lib/pdfValidation';
import { project } from '@/project';

const useUploadCounts = create<{ counts: Record<string, number> }>(() => ({ counts: {} }));

function bump(studyId: string, delta: number) {
  useUploadCounts.setState(s => ({
    counts: { ...s.counts, [studyId]: Math.max(0, (s.counts[studyId] ?? 0) + delta) },
  }));
}

export function useStudyPdfUploading(studyId: string): boolean {
  return useUploadCounts(s => (s.counts[studyId] ?? 0) > 0);
}

export async function uploadStudyPdfFiles(studyId: string, files: File[]): Promise<void> {
  bump(studyId, 1);
  try {
    for (const file of files) {
      const validation = await validatePdfFile(file);
      if (!validation.valid) {
        showToast.error(`${file.name} cannot be used`, validation.details.message);
        continue;
      }
      try {
        await project.pdf.upload(studyId, file);
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: `Could not upload ${file.name}` });
      }
    }
  } finally {
    bump(studyId, -1);
  }
}
