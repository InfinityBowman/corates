/**
 * EditPdfMetadataModal - Edit citation metadata for a PDF
 */

import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PdfEntry } from '@/stores/projectStore';

interface EditPdfMetadataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdf: PdfEntry | null;
  studyId: string;
  onSave: (
    studyId: string,
    pdfId: string,
    metadata: Record<string, unknown>,
  ) => Promise<void> | void;
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
        <div className='flex flex-col gap-4'>
          <div className='border-border bg-muted rounded-lg border p-3'>
            <div className='text-secondary-foreground truncate text-sm font-medium'>
              {pdf?.fileName}
            </div>
            <div className='text-muted-foreground mt-1 text-xs'>
              <Badge
                variant={pdf?.tag === 'primary' ? 'info' : 'secondary'}
                className={
                  pdf?.tag === 'protocol' ?
                    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : undefined
                }
              >
                {tagLabel}
              </Badge>
            </div>
          </div>

          <div>
            <Label htmlFor='edit-pdf-title' className='mb-1'>
              Article Title
            </Label>
            <Textarea
              id='edit-pdf-title'
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder='Full article title'
              rows={2}
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='edit-pdf-first-author' className='mb-1'>
                First Author
              </Label>
              <Input
                id='edit-pdf-first-author'
                type='text'
                value={firstAuthor}
                onChange={e => setFirstAuthor(e.target.value)}
                placeholder='e.g., Smith'
              />
            </div>
            <div>
              <Label htmlFor='edit-pdf-pub-year' className='mb-1'>
                Publication Year
              </Label>
              <Input
                id='edit-pdf-pub-year'
                type='number'
                value={publicationYear}
                onChange={e => setPublicationYear(e.target.value)}
                placeholder='e.g., 2024'
                min={1900}
                max={2100}
                inputMode='numeric'
              />
            </div>
          </div>

          <div>
            <Label htmlFor='edit-pdf-journal' className='mb-1'>
              Journal
            </Label>
            <Input
              id='edit-pdf-journal'
              type='text'
              value={journal}
              onChange={e => setJournal(e.target.value)}
              placeholder='e.g., Journal of Clinical Research'
            />
          </div>

          <div>
            <Label htmlFor='edit-pdf-doi' className='mb-1'>
              DOI
            </Label>
            <Input
              id='edit-pdf-doi'
              type='text'
              value={doi}
              onChange={e => setDoi(e.target.value)}
              placeholder='e.g., 10.1000/xyz123'
            />
          </div>

          <div className='border-border flex justify-end gap-3 border-t pt-4'>
            <Button variant='outline' onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
