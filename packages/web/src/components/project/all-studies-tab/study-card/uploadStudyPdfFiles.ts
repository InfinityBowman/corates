/**
 * Upload one or more picked or dropped PDFs to a study, one at a time so the
 * first file becomes the primary PDF when the study has none yet.
 */

import { showToast } from '@/lib/toast';
import { validatePdfFile } from '@/lib/pdfValidation';
import { project } from '@/project';

export async function uploadStudyPdfFiles(studyId: string, files: File[]): Promise<void> {
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
}
