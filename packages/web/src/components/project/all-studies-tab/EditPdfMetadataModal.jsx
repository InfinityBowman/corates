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
import { showToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { FiX } from 'solid-icons/fi';
import { handleError } from '@/lib/error-utils.js';

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
      await handleError(err, {
        toastTitle: 'Update Failed',
      });
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
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent class='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Edit PDF Metadata</DialogTitle>
            <DialogCloseTrigger>
              <FiX class='h-5 w-5' />
            </DialogCloseTrigger>
          </DialogHeader>
          <DialogBody>
            <div class='space-y-4'>
              {/* File info header */}
              <div class='border-border bg-muted rounded-lg border p-3'>
                <div class='text-secondary-foreground truncate text-sm font-medium'>
                  {props.pdf?.fileName}
                </div>
                <div class='text-muted-foreground mt-1 text-xs'>
                  <span
                    class={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                      props.pdf?.tag === 'primary' ? 'bg-blue-100 text-blue-800'
                      : props.pdf?.tag === 'protocol' ? 'bg-purple-100 text-purple-800'
                      : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {tagLabel()}
                  </span>
                </div>
              </div>

              {/* Article Title */}
              <div>
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                  Article Title
                </label>
                <textarea
                  value={title()}
                  onInput={e => setTitle(e.target.value)}
                  class='border-border focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 shadow-sm'
                  placeholder='Full article title'
                  rows={2}
                />
              </div>

              {/* Author and Year */}
              <div class='grid grid-cols-2 gap-4'>
                <div>
                  <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                    First Author
                  </label>
                  <input
                    type='text'
                    value={firstAuthor()}
                    onInput={e => setFirstAuthor(e.target.value)}
                    class='border-border focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 shadow-sm'
                    placeholder='e.g., Smith'
                  />
                </div>
                <div>
                  <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                    Publication Year
                  </label>
                  <input
                    type='number'
                    value={publicationYear()}
                    onInput={e => setPublicationYear(e.target.value)}
                    class='border-border focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 shadow-sm'
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
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                  Journal
                </label>
                <input
                  type='text'
                  value={journal()}
                  onInput={e => setJournal(e.target.value)}
                  class='border-border focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 shadow-sm'
                  placeholder='e.g., Journal of Clinical Research'
                />
              </div>

              {/* DOI */}
              <div>
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>DOI</label>
                <input
                  type='text'
                  value={doi()}
                  onInput={e => setDoi(e.target.value)}
                  class='border-border focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 shadow-sm'
                  placeholder='e.g., 10.1000/xyz123'
                />
              </div>

              {/* Actions */}
              <div class='border-border flex justify-end gap-3 border-t pt-4'>
                <button
                  type='button'
                  onClick={() => props.onOpenChange(false)}
                  disabled={saving()}
                  class='border-border bg-card text-secondary-foreground hover:bg-muted focus:ring-primary rounded-md border px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={handleSave}
                  disabled={saving()}
                  class='bg-primary hover:bg-primary/90 focus:ring-primary rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50'
                >
                  {saving() ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPositioner>
    </Dialog>
  );
}
