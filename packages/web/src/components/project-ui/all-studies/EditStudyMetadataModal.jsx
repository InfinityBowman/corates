/**
 * EditStudyMetadataModal - Modal for editing study citation metadata
 *
 * Fields:
 * - Display Name
 * - Article Title
 * - First Author
 * - Publication Year
 * - Journal
 * - DOI
 * - Abstract
 */

import { createSignal, createEffect } from 'solid-js';
import { Dialog, showToast, Collapsible } from '@corates/ui';
import { BiRegularChevronDown } from 'solid-icons/bi';

export default function EditStudyMetadataModal(props) {
  // props.open: boolean
  // props.onOpenChange: (open: boolean) => void
  // props.study: Study object
  // props.onSave: (studyId, updates) => Promise<void>

  const [name, setName] = createSignal('');
  const [originalTitle, setOriginalTitle] = createSignal('');
  const [firstAuthor, setFirstAuthor] = createSignal('');
  const [publicationYear, setPublicationYear] = createSignal('');
  const [journal, setJournal] = createSignal('');
  const [doi, setDoi] = createSignal('');
  const [abstract, setAbstract] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  // Reset form when study changes or modal opens
  createEffect(() => {
    const study = props.study;
    if (study && props.open) {
      setName(study.name || '');
      setOriginalTitle(study.originalTitle || study.name || '');
      setFirstAuthor(study.firstAuthor || '');
      setPublicationYear(study.publicationYear?.toString() || '');
      setJournal(study.journal || '');
      setDoi(study.doi || '');
      setAbstract(study.abstract || '');
    }
  });

  const handleSave = async () => {
    if (!props.study) return;

    setSaving(true);
    try {
      // Validate publication year
      let parsedPublicationYear;
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

      const updates = {
        name: name().trim() || props.study.name,
        originalTitle: originalTitle().trim() || undefined,
        firstAuthor: firstAuthor().trim() || undefined,
        publicationYear: parsedPublicationYear,
        journal: journal().trim() || undefined,
        doi: doi().trim() || undefined,
        abstract: abstract().trim() || undefined,
      };

      await props.onSave?.(props.study.id, updates);
      props.onOpenChange(false);
    } catch (err) {
      console.error('Error updating study:', err);
      showToast.error('Update Failed', 'Failed to update study.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title='Edit Study Metadata'
      size='lg'
    >
      <div class='space-y-4'>
        {/* Display Name */}
        <div>
          <label class='block text-sm font-medium text-gray-700 mb-1'>Display Name</label>
          <input
            type='text'
            value={name()}
            onInput={e => setName(e.target.value)}
            class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            placeholder='Enter display name'
          />
          <p class='mt-1 text-xs text-gray-500'>
            Short name shown in lists. Leave blank to auto-generate from author and year.
          </p>
        </div>

        {/* Citation Information - Collapsible */}
        <div class='border-t border-gray-200 pt-4'>
          <Collapsible
            defaultOpen={true}
            trigger={api => (
              <button
                {...api.getTriggerProps()}
                class='flex items-center justify-between w-full text-left py-2 text-sm font-medium text-gray-900 hover:text-gray-700'
              >
                <span>Citation Information</span>
                <BiRegularChevronDown
                  class={`w-5 h-5 text-gray-500 transition-transform ${api.open ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          >
            <div class='space-y-4 pt-2'>
              {/* Article Title */}
              <div>
                <label class='block text-sm font-medium text-gray-700 mb-1'>Article Title</label>
                <textarea
                  value={originalTitle()}
                  onInput={e => setOriginalTitle(e.target.value)}
                  class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Full original title as imported'
                  rows={2}
                />
              </div>

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
                  <label class='block text-sm font-medium text-gray-700 mb-1'>
                    Publication Year
                  </label>
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

              {/* Abstract */}
              <div>
                <label class='block text-sm font-medium text-gray-700 mb-1'>Abstract</label>
                <textarea
                  value={abstract()}
                  onInput={e => setAbstract(e.target.value)}
                  class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Enter abstract...'
                  rows={3}
                />
              </div>
            </div>
          </Collapsible>
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
