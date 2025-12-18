/**
 * StudyPdfSection - PDF management section within a study card
 *
 * Wrapper around PdfList that:
 * - Passes study PDFs
 * - Handles upload via file input + Google Drive
 * - Connects to PDF handlers
 */

import { createSignal, createMemo, Show, For } from 'solid-js';
import { FaBrandsGoogleDrive, FaSolidPlus } from 'solid-icons/fa';
import { showToast } from '@corates/ui';
import PdfListItem from '@/components/checklist-ui/pdf/PdfListItem.jsx';

export default function StudyPdfSection(props) {
  // props.study: Study object with pdfs array
  // props.onViewPdf: (studyId, pdf) => void
  // props.onDownloadPdf: (studyId, pdf) => void
  // props.onUploadPdf: (studyId, file) => Promise<void>
  // props.onDeletePdf: (studyId, pdf) => void
  // props.onTagChange: (studyId, pdfId, newTag) => void
  // props.onEditPdfMetadata: (studyId, pdf) => void
  // props.onOpenGoogleDrive: (studyId) => void
  // props.readOnly: boolean

  const [uploading, setUploading] = createSignal(false);
  let fileInputRef;

  const study = () => props.study;
  const pdfs = () => study().pdfs || [];

  // Sort PDFs: primary first, then protocol, then secondary by uploadedAt desc
  const sortedPdfs = createMemo(() => {
    return [...pdfs()].sort((a, b) => {
      const tagOrder = { primary: 0, protocol: 1, secondary: 2 };
      const tagA = tagOrder[a.tag] ?? 2;
      const tagB = tagOrder[b.tag] ?? 2;
      if (tagA !== tagB) return tagA - tagB;
      return (b.uploadedAt || 0) - (a.uploadedAt || 0);
    });
  });

  const hasPrimary = createMemo(() => pdfs().some(pdf => pdf.tag === 'primary'));
  const hasProtocol = createMemo(() => pdfs().some(pdf => pdf.tag === 'protocol'));

  const handleFileSelect = async e => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      showToast.error('Invalid File', 'Please select a PDF file');
      return;
    }

    setUploading(true);
    try {
      await props.onUploadPdf?.(study().id, file);
    } catch (err) {
      console.error('Error uploading PDF:', err);
      showToast.error('Upload Failed', 'Failed to upload PDF');
    } finally {
      setUploading(false);
      if (fileInputRef) fileInputRef.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef?.click();
  };

  const handleView = pdf => {
    props.onViewPdf?.(study().id, pdf);
  };

  const handleDownload = pdf => {
    props.onDownloadPdf?.(study().id, pdf);
  };

  const handleDelete = pdf => {
    props.onDeletePdf?.(study().id, pdf);
  };

  const handleTagChange = (pdfId, newTag) => {
    props.onTagChange?.(study().id, pdfId, newTag);
  };

  const handleEditMetadata = pdf => {
    props.onEditPdfMetadata?.(study().id, pdf);
  };

  return (
    <div class='px-4 pb-4'>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type='file'
        accept='application/pdf'
        class='hidden'
        onChange={handleFileSelect}
      />

      {/* PDF List with custom upload area */}
      <div class='space-y-3'>
        <div class='flex items-center justify-between'>
          <h4 class='text-sm font-medium text-gray-700'>PDFs ({pdfs().length})</h4>
          <Show when={!props.readOnly}>
            <div class='flex items-center gap-2 mt-1'>
              <button
                type='button'
                onClick={triggerFileInput}
                disabled={uploading()}
                class='inline-flex items-center gap-1 px-2 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {uploading() ? 'Uploading...' : <FaSolidPlus />}
              </button>
              <button
                type='button'
                onClick={() => props.onOpenGoogleDrive?.(study().id)}
                class='px-2 py-1.5 text-gray-500 text-sm font-medium hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
                title='Import from Google Drive'
              >
                <FaBrandsGoogleDrive />
              </button>
            </div>
          </Show>
        </div>

        {/* PDF items or empty state */}
        <Show
          when={pdfs().length > 0}
          fallback={
            <div class='p-6 text-center border-2 border-dashed border-gray-200 rounded-lg'>
              <p class='text-sm text-gray-500'>No PDFs uploaded yet</p>
              <Show when={!props.readOnly}>
                <div class='flex items-center justify-center gap-2 mt-2'>
                  <button
                    type='button'
                    onClick={triggerFileInput}
                    disabled={uploading()}
                    class='text-sm text-blue-600 hover:text-blue-700'
                  >
                    Upload a PDF
                  </button>
                  <span class='text-gray-400'>or</span>
                  <button
                    type='button'
                    onClick={() => props.onOpenGoogleDrive?.(study().id)}
                    class='text-sm text-blue-600 hover:text-blue-700'
                  >
                    Import from Google Drive
                  </button>
                </div>
              </Show>
            </div>
          }
        >
          <div class='space-y-2'>
            <For each={sortedPdfs()}>
              {pdf => (
                <PdfListItem
                  pdf={pdf}
                  onView={handleView}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  onTagChange={handleTagChange}
                  onEditMetadata={handleEditMetadata}
                  readOnly={props.readOnly}
                  hasPrimary={hasPrimary() && pdf.tag !== 'primary'}
                  hasProtocol={hasProtocol() && pdf.tag !== 'protocol'}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
