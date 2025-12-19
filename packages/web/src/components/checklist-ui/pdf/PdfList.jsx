/**
 * PdfList - List all PDFs for a study with tag management
 *
 * Features:
 * - Display all PDFs with their tags (badge indicators)
 * - View/download PDF
 * - Delete PDF (with confirmation)
 * - Change tag via dropdown menu
 * - Visual distinction for primary/protocol/secondary
 */

import { For, Show, createMemo } from 'solid-js';
import { HiOutlineDocumentPlus } from 'solid-icons/hi';
import PdfListItem from './PdfListItem.jsx';

export default function PdfList(props) {
  // props.pdfs: Array<{ id, fileName, key, size, uploadedAt, tag }>
  // props.onView: (pdf) => void
  // props.onDownload: (pdf) => void
  // props.onDelete: (pdf) => void
  // props.onTagChange: (pdfId, newTag) => void
  // props.onUpload: () => void - trigger file picker
  // props.readOnly: boolean
  // props.uploading: boolean

  const sortedPdfs = createMemo(() => {
    const pdfs = props.pdfs || [];
    // Sort: primary first, then protocol, then secondary by uploadedAt desc
    return pdfs.toSorted((a, b) => {
      const tagOrder = { primary: 0, protocol: 1, secondary: 2 };
      const tagA = tagOrder[a.tag] ?? 2;
      const tagB = tagOrder[b.tag] ?? 2;
      if (tagA !== tagB) return tagA - tagB;
      return (b.uploadedAt || 0) - (a.uploadedAt || 0);
    });
  });

  const hasPrimary = createMemo(() => (props.pdfs || []).some(pdf => pdf.tag === 'primary'));

  const hasProtocol = createMemo(() => (props.pdfs || []).some(pdf => pdf.tag === 'protocol'));

  return (
    <div class='space-y-2'>
      {/* Header with upload button */}
      <div class='flex items-center justify-between'>
        <h4 class='text-sm font-medium text-gray-700'>PDFs ({(props.pdfs || []).length})</h4>
        <Show when={!props.readOnly}>
          <button
            type='button'
            onClick={() => props.onUpload?.()}
            disabled={props.uploading}
            class='inline-flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50'
          >
            <HiOutlineDocumentPlus class='h-4 w-4' />
            <span>{props.uploading ? 'Uploading...' : 'Add PDF'}</span>
          </button>
        </Show>
      </div>

      {/* PDF list */}
      <Show
        when={sortedPdfs().length > 0}
        fallback={
          <div class='rounded-lg border-2 border-dashed border-gray-200 p-6 text-center'>
            <HiOutlineDocumentPlus class='mx-auto mb-2 h-10 w-10 text-gray-300' />
            <p class='text-sm text-gray-500'>No PDFs uploaded yet</p>
            <Show when={!props.readOnly}>
              <button
                type='button'
                onClick={() => props.onUpload?.()}
                disabled={props.uploading}
                class='mt-2 text-sm text-blue-600 hover:text-blue-700'
              >
                Upload a PDF
              </button>
            </Show>
          </div>
        }
      >
        <div class='space-y-2'>
          <For each={sortedPdfs()}>
            {pdf => (
              <PdfListItem
                pdf={pdf}
                onView={props.onView}
                onDownload={props.onDownload}
                onDelete={props.onDelete}
                onTagChange={props.onTagChange}
                readOnly={props.readOnly}
                hasPrimary={hasPrimary() && pdf.tag !== 'primary'}
                hasProtocol={hasProtocol() && pdf.tag !== 'protocol'}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
