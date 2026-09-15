/**
 * StudyPdfs - the PDFs on one study: list with tags and metadata, plus
 * upload and Google Drive import. Uses the typed project singleton for all
 * PDF operations.
 */

import { useState, useRef } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PdfListItem } from '@/components/pdf/PdfListItem';
import { EditPdfMetadataModal } from '../all-studies-tab/EditPdfMetadataModal';
import { GoogleDrivePickerModal } from '../google-drive/GoogleDrivePickerModal';
import { useProjectContext } from '../ProjectContext';
import { project } from '@/project';
import type { StudyInfo, PdfEntry } from '@/stores/projectStore';
import { uploadStudyPdfFiles, useStudyPdfUploading } from './uploadStudyPdfFiles';

interface StudyPdfsProps {
  study: StudyInfo;
}

const tagOrder: Record<string, number> = { primary: 0, protocol: 1, secondary: 2 };

export function StudyPdfs({ study }: StudyPdfsProps) {
  const { projectId } = useProjectContext();
  const [editingPdf, setEditingPdf] = useState<PdfEntry | null>(null);
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploading = useStudyPdfUploading(study.id);

  const pdfs = study.pdfs || [];
  const sortedPdfs = [...pdfs].sort((a, b) => {
    const tagA = tagOrder[a.tag] ?? 2;
    const tagB = tagOrder[b.tag] ?? 2;
    if (tagA !== tagB) return tagA - tagB;
    return (b.uploadedAt || 0) - (a.uploadedAt || 0);
  });

  const hasPrimary = pdfs.some(p => p.tag === 'primary');
  const hasProtocol = pdfs.some(p => p.tag === 'protocol');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length > 0) void uploadStudyPdfFiles(study.id, files);
  };

  return (
    <div data-testid='study-pdfs'>
      <input
        ref={fileInputRef}
        type='file'
        accept='application/pdf'
        multiple
        className='hidden'
        data-testid='study-pdf-input'
        onChange={handleFileSelect}
      />

      <div className='border-border flex items-center justify-between border-t px-4 pt-3 pb-1.5'>
        <p className='text-2xs text-muted-foreground font-semibold tracking-wide uppercase'>
          PDFs ({pdfs.length})
        </p>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='xs'
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className='text-primary hover:text-primary'
            title='Upload PDF'
            aria-label='Upload PDF'
          >
            {uploading ? 'Uploading...' : <PlusIcon className='size-4' />}
          </Button>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={() => setDriveOpen(true)}
            title='Import from Google Drive'
            aria-label='Import from Google Drive'
          >
            <img src='/logos/drive.svg' alt='' className='size-4' />
          </Button>
        </div>
      </div>

      {pdfs.length > 0 ?
        <div className='flex flex-col gap-2 px-4 pb-4'>
          {sortedPdfs.map(pdf => (
            <PdfListItem
              key={pdf.id}
              pdf={pdf}
              onView={p => project.pdf.view(study.id, p)}
              onDownload={p => project.pdf.download(study.id, p)}
              onDelete={p => project.pdf.delete(study.id, p)}
              onTagChange={(pdfId, newTag) => project.pdf.updateTag(study.id, pdfId, newTag)}
              onEditMetadata={p => {
                setEditingPdf(p);
                setMetadataModalOpen(true);
              }}
              hasPrimary={hasPrimary && pdf.tag !== 'primary'}
              hasProtocol={hasProtocol && pdf.tag !== 'protocol'}
            />
          ))}
        </div>
      : <div className='border-border mx-4 mb-4 rounded-lg border-2 border-dashed p-6 text-center'>
          <p className='text-muted-foreground text-sm'>
            No PDFs on this study yet. Reviewers read the PDF while they appraise it.
          </p>
          <div className='mt-2 flex items-center justify-center gap-2'>
            <Button
              variant='link'
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className='h-auto p-0 text-sm font-normal'
            >
              Upload a PDF
            </Button>
            <span className='text-muted-foreground/70'>or</span>
            <Button
              variant='link'
              onClick={() => setDriveOpen(true)}
              className='h-auto p-0 text-sm font-normal'
            >
              Import from Google Drive
            </Button>
          </div>
          <p className='text-muted-foreground/70 mt-2 text-xs'>Or drop a PDF anywhere here.</p>
        </div>
      }

      <EditPdfMetadataModal
        open={metadataModalOpen}
        onOpenChange={setMetadataModalOpen}
        pdf={editingPdf}
        studyId={study.id}
        onSave={(sid, pdfId, metadata) => project.pdf.updateMetadata(sid, pdfId, metadata)}
      />

      <GoogleDrivePickerModal
        open={driveOpen}
        onClose={() => setDriveOpen(false)}
        projectId={projectId}
        studyId={study.id}
        onImportSuccess={file => void project.pdf.handleGoogleDriveImport(study.id, file)}
      />
    </div>
  );
}
