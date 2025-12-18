/**
 * EditPdfMetadataModal - Modal for editing PDF citation metadata
 *
 * Fields:
 * - Article Title
 * - First Author
 * - Publication Year
 * - Journal
 * - DOI
 */

import { createSignal, createEffect } from 'solid-js';
import { Dialog, showToast } from '@corates/ui';

export default function EditPdfMetadataModal(props) {
  // props.open: boolean
  // props.onOpenChange: (open: boolean) => void
  // props.pdf: PDF object { id, fileName, tag, title?, firstAuthor?, publicationYear?, journal?, doi?, abstract? }
  // props.studyId: string
  // props.onSave: (studyId, pdfId, metadata) => void

  const [title, setTitle] = createSignal('');
  const [firstAuthor, setFirstAuthor] = createSignal('');
  const [publicationYear, setPublicationYear] = createSignal('');
  const [journal, setJournal] = createSignal('');
  const [doi, setDoi] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  // Reset form when PDF changes or modal opens
  createEffect(() => {
    const pdf = props.pdf;
    if (pdf && props.open) {
      setTitle(pdf.title || '');
      setFirstAuthor(pdf.firstAuthor || '');
      setPublicationYear(pdf.publicationYear?.toString() || '');
      setJournal(pdf.journal || '');
      setDoi(pdf.doi || '');
    }
  });

  const handleSave = async () => {
    if (!props.pdf || !props.studyId) return;

    setSaving(true);
    try {
      // Validate publication year
      let parsedPublicationYear = 0;
      if (publicationYear()) {
        const raw = publicationYear().toString().trim();
        const num = Number(raw);
        if (Number.isFinite(num)) {
          const trunc = Math.trunc(num);
          if (Number.isInteger(trunc) && trunc >= 1900 && trunc <= 2100) {
            parsedPublicationYear = trunc;
          }
        }
      }

      const metadata = {
        title: title().trim() || undefined,
        firstAuthor: firstAuthor().trim() || undefined,
        publicationYear: parsedPublicationYear,
        journal: journal().trim() || undefined,
        doi: doi().trim() || undefined,
      };

      await props.onSave?.(props.studyId, props.pdf.id, metadata);
      showToast.success('PDF Updated', 'Citation metadata saved.');
      props.onOpenChange(false);
    } catch (err) {
      console.error('Error updating PDF metadata:', err);
      showToast.error('Update Failed', 'Failed to update PDF metadata.');
    } finally {
      setSaving(false);
    }
  };

  const tagLabel = () => {
    const tag = props.pdf?.tag;
    if (tag === 'primary') return 'Primary Report';
    if (tag === 'protocol') return 'Protocol';
    return 'Secondary';
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} title='Edit PDF Metadata' size='lg'>
      <div class='space-y-4'>
        {/* File info header */}
        <div class='bg-gray-50 rounded-lg p-3 border border-gray-200'>
          <div class='text-sm font-medium text-gray-700 truncate'>{props.pdf?.fileName}</div>
          <div class='text-xs text-gray-500 mt-1'>
            <span
              class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                props.pdf?.tag === 'primary' ? 'bg-blue-100 text-blue-800'
                : props.pdf?.tag === 'protocol' ? 'bg-purple-100 text-purple-800'
                : 'bg-gray-100 text-gray-700'
              }`}
            >
              {tagLabel()}
            </span>
          </div>
        </div>

        {/* Article Title */}
        <div>
          <label class='block text-sm font-medium text-gray-700 mb-1'>Article Title</label>
          <textarea
            value={title()}
            onInput={e => setTitle(e.target.value)}
            class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            placeholder='Full article title'
            rows={2}
          />
        </div>

        {/* Author and Year */}
        <div class='grid grid-cols-2 gap-4'>
          <div>
            <label class='block text-sm font-medium text-gray-700 mb-1'>First Author</label>
            <input
              type='text'
              value={firstAuthor()}
              onInput={e => setFirstAuthor(e.target.value)}
              class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              placeholder='e.g., Smith'
            />
          </div>
          <div>
            <label class='block text-sm font-medium text-gray-700 mb-1'>Publication Year</label>
            <input
              type='number'
              value={publicationYear()}
              onInput={e => setPublicationYear(e.target.value)}
              class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              placeholder='e.g., 2024'
              min='1900'
              max='2100'
              step='1'
              inputMode='numeric'
            />
          </div>
        </div>

        {/* Journal */}
        <div>
          <label class='block text-sm font-medium text-gray-700 mb-1'>Journal</label>
          <input
            type='text'
            value={journal()}
            onInput={e => setJournal(e.target.value)}
            class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            placeholder='e.g., Journal of Clinical Research'
          />
        </div>

        {/* DOI */}
        <div>
          <label class='block text-sm font-medium text-gray-700 mb-1'>DOI</label>
          <input
            type='text'
            value={doi()}
            onInput={e => setDoi(e.target.value)}
            class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            placeholder='e.g., 10.1000/xyz123'
          />
        </div>

        {/* Actions */}
        <div class='flex justify-end gap-3 pt-4 border-t border-gray-200'>
          <button
            type='button'
            onClick={() => props.onOpenChange(false)}
            disabled={saving()}
            class='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleSave}
            disabled={saving()}
            class='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
          >
            {saving() ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
