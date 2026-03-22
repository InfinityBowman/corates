/**
 * StudyPdfSection - PDF management section within a study card
 * Uses the typed project singleton for all PDF operations.
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import { PlusIcon } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { PdfListItem } from '@/components/pdf/PdfListItem';
import { EditPdfMetadataModal } from '../EditPdfMetadataModal';
import { project } from '@/project';
import { validatePdfFile } from '@/lib/pdfValidation.js';

/* eslint-disable no-unused-vars */
interface StudyPdfSectionProps {
  study: any;
  onOpenGoogleDrive?: (studyId: string) => void;
  readOnly?: boolean;
}

export function StudyPdfSection({ study, onOpenGoogleDrive, readOnly }: StudyPdfSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [editingPdf, setEditingPdf] = useState<any>(null);
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pdfs = study.pdfs || [];

  const sortedPdfs = useMemo(() => {
    return [...pdfs].sort((a: any, b: any) => {
      const tagOrder: Record<string, number> = { primary: 0, protocol: 1, secondary: 2 };
      const tagA = tagOrder[a.tag] ?? 2;
      const tagB = tagOrder[b.tag] ?? 2;
      if (tagA !== tagB) return tagA - tagB;
      return (b.uploadedAt || 0) - (a.uploadedAt || 0);
    });
  }, [pdfs]);

  const hasPrimary = pdfs.some((p: any) => p.tag === 'primary');
  const hasProtocol = pdfs.some((p: any) => p.tag === 'protocol');

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validation = (await validatePdfFile(file)) as any;
      if (!validation.valid) {
        showToast.error('Invalid File', validation.details.message as string);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setUploading(true);
      try {
        await project.pdf.upload(study.id, file);
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Upload Failed' });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [study.id],
  );

  return (
    <div className='px-4 pb-4'>
      <input
        ref={fileInputRef}
        type='file'
        accept='application/pdf'
        className='hidden'
        onChange={handleFileSelect}
      />

      <div className='flex flex-col gap-3'>
        <div className='flex items-center justify-between'>
          <h4 className='text-secondary-foreground text-sm font-medium'>PDFs ({pdfs.length})</h4>
          {!readOnly && (
            <div className='mt-1 flex items-center gap-2'>
              <button
                type='button'
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className='text-primary inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1.5 text-sm font-medium transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {uploading ? 'Uploading...' : <PlusIcon className='size-4' />}
              </button>
              <button
                type='button'
                onClick={() => onOpenGoogleDrive?.(study.id)}
                className='text-muted-foreground hover:text-primary rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-blue-50'
                title='Import from Google Drive'
              >
                <img src='/logos/drive.svg' alt='Google Drive' className='size-4' />
              </button>
            </div>
          )}
        </div>

        {pdfs.length > 0 ?
          <div className='flex flex-col gap-2'>
            {sortedPdfs.map((pdf: any) => (
              <PdfListItem
                key={pdf.id}
                pdf={pdf}
                onView={p => project.pdf.view(study.id, p)}
                onDownload={p => project.pdf.download(study.id, p)}
                onDelete={p => project.pdf.delete(study.id, p)}
                onTagChange={(pdfId, newTag) =>
                  project.pdf.updateTag(study.id, pdfId, newTag)
                }
                onEditMetadata={p => {
                  setEditingPdf(p);
                  setMetadataModalOpen(true);
                }}
                readOnly={readOnly}
                hasPrimary={hasPrimary && pdf.tag !== 'primary'}
                hasProtocol={hasProtocol && pdf.tag !== 'protocol'}
              />
            ))}
          </div>
        : <div className='border-border rounded-lg border-2 border-dashed p-6 text-center'>
            <p className='text-muted-foreground text-sm'>No PDFs uploaded yet</p>
            {!readOnly && (
              <div className='mt-2 flex items-center justify-center gap-2'>
                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className='text-primary hover:text-primary/80 text-sm'
                >
                  Upload a PDF
                </button>
                <span className='text-muted-foreground/70'>or</span>
                <button
                  type='button'
                  onClick={() => onOpenGoogleDrive?.(study.id)}
                  className='text-primary hover:text-primary/80 text-sm'
                >
                  Import from Google Drive
                </button>
              </div>
            )}
          </div>
        }
      </div>

      <EditPdfMetadataModal
        open={metadataModalOpen}
        onOpenChange={setMetadataModalOpen}
        pdf={editingPdf}
        studyId={study.id}
        onSave={(sid, pdfId, metadata) =>
          project.pdf.updateMetadata(sid, pdfId, metadata)
        }
      />
    </div>
  );
}
