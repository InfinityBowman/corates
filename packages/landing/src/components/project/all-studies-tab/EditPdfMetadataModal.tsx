/**
 * EditPdfMetadataModal - Edit citation metadata for a PDF
 */

import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/* eslint-disable no-unused-vars */
interface EditPdfMetadataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdf: any;
  studyId: string;
  onSave: (studyId: string, pdfId: string, metadata: any) => Promise<void> | void;
}

export function EditPdfMetadataModal({
  open,
  onOpenChange,
  pdf,
  studyId,
  onSave,
}: EditPdfMetadataModalProps) {
  const [title, setTitle] = useState('');
  const [firstAuthor, setFirstAuthor] = useState('');
  const [publicationYear, setPublicationYear] = useState('');
  const [journal, setJournal] = useState('');
  const [doi, setDoi] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pdf && open) {
      setTitle(pdf.title || '');
      setFirstAuthor(pdf.firstAuthor || '');
      setPublicationYear(pdf.publicationYear?.toString() || '');
      setJournal(pdf.journal || '');
      setDoi(pdf.doi || '');
    }
  }, [pdf, open]);

  const handleSave = useCallback(async () => {
    if (!pdf || !studyId) return;
    setSaving(true);
    try {
      let parsedYear = 0;
      if (publicationYear) {
        const num = Number(publicationYear.trim());
        if (Number.isFinite(num)) {
          const trunc = Math.trunc(num);
          if (trunc >= 1900 && trunc <= 2100) {
            parsedYear = trunc;
          } else {
            showToast.error('Invalid Year', 'Publication year must be between 1900 and 2100.');
            setSaving(false);
            return;
          }
        }
      }
      await onSave(studyId, pdf.id, {
        title: title.trim() || undefined,
        firstAuthor: firstAuthor.trim() || undefined,
        publicationYear: parsedYear,
        journal: journal.trim() || undefined,
        doi: doi.trim() || undefined,
      });
      showToast.success('PDF Updated', 'Citation metadata saved.');
      onOpenChange(false);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Update Failed' });
    } finally {
      setSaving(false);
    }
  }, [pdf, studyId, title, firstAuthor, publicationYear, journal, doi, onSave, onOpenChange]);

  const tagLabel =
    pdf?.tag === 'primary' ? 'Primary Report'
    : pdf?.tag === 'protocol' ? 'Protocol'
    : 'Secondary';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Edit PDF Metadata</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='border-border bg-muted rounded-lg border p-3'>
            <div className='text-secondary-foreground truncate text-sm font-medium'>
              {pdf?.fileName}
            </div>
            <div className='text-muted-foreground mt-1 text-xs'>
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                  pdf?.tag === 'primary' ? 'bg-blue-100 text-blue-800'
                  : pdf?.tag === 'protocol' ? 'bg-purple-100 text-purple-800'
                  : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {tagLabel}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor='edit-pdf-title' className='text-secondary-foreground mb-1 block text-sm font-medium'>
              Article Title
            </label>
            <textarea
              id='edit-pdf-title'
              value={title}
              onChange={e => setTitle(e.target.value)}
              className='border-border focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 shadow-sm'
              placeholder='Full article title'
              rows={2}
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label htmlFor='edit-pdf-first-author' className='text-secondary-foreground mb-1 block text-sm font-medium'>
                First Author
              </label>
              <input
                id='edit-pdf-first-author'
                type='text'
                value={firstAuthor}
                onChange={e => setFirstAuthor(e.target.value)}
                className='border-border focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 shadow-sm'
                placeholder='e.g., Smith'
              />
            </div>
            <div>
              <label htmlFor='edit-pdf-pub-year' className='text-secondary-foreground mb-1 block text-sm font-medium'>
                Publication Year
              </label>
              <input
                id='edit-pdf-pub-year'
                type='number'
                value={publicationYear}
                onChange={e => setPublicationYear(e.target.value)}
                className='border-border focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 shadow-sm'
                placeholder='e.g., 2024'
                min={1900}
                max={2100}
                inputMode='numeric'
              />
            </div>
          </div>

          <div>
            <label htmlFor='edit-pdf-journal' className='text-secondary-foreground mb-1 block text-sm font-medium'>
              Journal
            </label>
            <input
              id='edit-pdf-journal'
              type='text'
              value={journal}
              onChange={e => setJournal(e.target.value)}
              className='border-border focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 shadow-sm'
              placeholder='e.g., Journal of Clinical Research'
            />
          </div>

          <div>
            <label htmlFor='edit-pdf-doi' className='text-secondary-foreground mb-1 block text-sm font-medium'>DOI</label>
            <input
              id='edit-pdf-doi'
              type='text'
              value={doi}
              onChange={e => setDoi(e.target.value)}
              className='border-border focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 shadow-sm'
              placeholder='e.g., 10.1000/xyz123'
            />
          </div>

          <div className='border-border flex justify-end gap-3 border-t pt-4'>
            <button
              type='button'
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className='border-border bg-card text-secondary-foreground hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleSave}
              disabled={saving}
              className='bg-primary hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
