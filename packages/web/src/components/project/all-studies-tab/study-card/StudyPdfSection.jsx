/**
 * StudyPdfSection - PDF management section within a study card
 *
 * Directly imports projectActionsStore for all PDF operations.
 * No callback props needed - component handles all actions internally.
 */

import { createSignal, createMemo, Show, For } from 'solid-js';
import { FaBrandsGoogleDrive, FaSolidPlus } from 'solid-icons/fa';
import { showToast } from '@/components/ui/toast';
import { PdfListItem } from '@pdf';
import EditPdfMetadataModal from '@/components/project/all-studies-tab/EditPdfMetadataModal.jsx';
import projectActionsStore from '@/stores/projectActionsStore';
import { validatePdfFile } from '@/lib/pdfValidation.js';

export default function StudyPdfSection(props) {
  // props.study: Study object with pdfs array
  // props.onOpenGoogleDrive: (studyId) => void - Google Drive picker callback (needs modal state at parent)
  // props.readOnly: boolean

  const [uploading, setUploading] = createSignal(false);
  const [editingPdf, setEditingPdf] = createSignal(null);
  const [metadataModalOpen, setMetadataModalOpen] = createSignal(false);
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
    if (!file) return;

    // Validate file before upload
    const validation = await validatePdfFile(file);
    if (!validation.valid) {
      showToast.error('Invalid File', validation.details.message);
      if (fileInputRef) fileInputRef.value = '';
      return;
    }

    setUploading(true);
    try {
      await projectActionsStore.pdf.upload(study().id, file);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        toastTitle: 'Upload Failed',
      });
    } finally {
      setUploading(false);
      if (fileInputRef) fileInputRef.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef?.click();
  };

  const handleView = pdf => {
    projectActionsStore.pdf.view(study().id, pdf);
  };

  const handleDownload = pdf => {
    projectActionsStore.pdf.download(study().id, pdf);
  };

  const handleDelete = pdf => {
    projectActionsStore.pdf.delete(study().id, pdf);
  };

  const handleTagChange = (pdfId, newTag) => {
    projectActionsStore.pdf.updateTag(study().id, pdfId, newTag);
  };

  const handleEditMetadata = pdf => {
    setEditingPdf(pdf);
    setMetadataModalOpen(true);
  };

  const handleSaveMetadata = async (studyId, pdfId, metadata) => {
    projectActionsStore.pdf.updateMetadata(studyId, pdfId, metadata);
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
          <h4 class='text-secondary-foreground text-sm font-medium'>PDFs ({pdfs().length})</h4>
          <Show when={!props.readOnly}>
            <div class='mt-1 flex items-center gap-2'>
              <button
                type='button'
                onClick={triggerFileInput}
                disabled={uploading()}
                class='text-primary inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1.5 text-sm font-medium transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {uploading() ? 'Uploading...' : <FaSolidPlus />}
              </button>
              <button
                type='button'
                onClick={() => props.onOpenGoogleDrive?.(study().id)}
                class='text-muted-foreground hover:text-primary rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-blue-50'
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
            <div class='border-border rounded-lg border-2 border-dashed p-6 text-center'>
              <p class='text-muted-foreground text-sm'>No PDFs uploaded yet</p>
              <Show when={!props.readOnly}>
                <div class='mt-2 flex items-center justify-center gap-2'>
                  <button
                    type='button'
                    onClick={triggerFileInput}
                    disabled={uploading()}
                    class='text-primary hover:text-primary/80 text-sm'
                  >
                    Upload a PDF
                  </button>
                  <span class='text-muted-foreground/70'>or</span>
                  <button
                    type='button'
                    onClick={() => props.onOpenGoogleDrive?.(study().id)}
                    class='text-primary hover:text-primary/80 text-sm'
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

      {/* Edit Metadata Modal */}
      <EditPdfMetadataModal
        open={metadataModalOpen()}
        onOpenChange={setMetadataModalOpen}
        pdf={editingPdf()}
        studyId={study().id}
        onSave={handleSaveMetadata}
      />
    </div>
  );
}
