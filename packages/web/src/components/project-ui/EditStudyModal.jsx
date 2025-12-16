import { createSignal, createEffect, createMemo, Show } from 'solid-js';
import { Dialog } from '@components/zag/Dialog.jsx';
import { showToast } from '@components/zag/Toast.jsx';
import Select from '@components/zag/Select.jsx';
import Collapsible from '@components/zag/Collapsible.jsx';
import { BiRegularUser, BiRegularChevronDown } from 'solid-icons/bi';
import projectStore from '@/stores/projectStore.js';

/**
 * EditStudyModal - Modal for editing study metadata and reviewer assignments
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onOpenChange - Callback when open state changes
 * @param {Object} props.study - The study to edit
 * @param {string} props.projectId - The project ID
 * @param {Function} props.onUpdateStudy - Callback to update the study
 */
export default function EditStudyModal(props) {
  const [name, setName] = createSignal('');
  const [firstAuthor, setFirstAuthor] = createSignal('');
  const [publicationYear, setPublicationYear] = createSignal('');
  const [journal, setJournal] = createSignal('');
  const [doi, setDoi] = createSignal('');
  const [abstract, setAbstract] = createSignal('');
  const [reviewer1, setReviewer1] = createSignal('');
  const [reviewer2, setReviewer2] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  const members = () => projectStore.getMembers(props.projectId) || [];

  // Convert members to Select items format
  const memberItems = createMemo(() => {
    const getMemberName = member =>
      member?.displayName || member?.name || member?.email || 'Unknown';

    return [
      { label: 'Unassigned', value: '' },
      ...members().map(m => ({
        label: getMemberName(m),
        value: m.userId,
      })),
    ];
  });

  // Reset form when study changes or modal opens
  createEffect(() => {
    const study = props.study;
    if (study && props.open) {
      setName(study.name || '');
      setFirstAuthor(study.firstAuthor || '');
      setPublicationYear(study.publicationYear?.toString() || '');
      setJournal(study.journal || '');
      setDoi(study.doi || '');
      setAbstract(study.abstract || '');
      setReviewer1(study.reviewer1 || '');
      setReviewer2(study.reviewer2 || '');
    }
  });

  const handleSave = async () => {
    if (!props.study) return;

    setSaving(true);
    try {
      const updates = {
        name: name().trim() || props.study.name,
        firstAuthor: firstAuthor().trim() || undefined,
        publicationYear: publicationYear() ? parseInt(publicationYear(), 10) : undefined,
        journal: journal().trim() || undefined,
        doi: doi().trim() || undefined,
        abstract: abstract().trim() || undefined,
        reviewer1: reviewer1() || null,
        reviewer2: reviewer2() || null,
      };

      await props.onUpdateStudy(props.study.id, updates);
      props.onOpenChange(false);
    } catch (err) {
      console.error('Error updating study:', err);
      showToast.error('Update Failed', 'Failed to update study.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} title='Edit Study' size='lg'>
      <div class='space-y-4'>
        {/* Study Name */}
        <div>
          <label class='block text-sm font-medium text-gray-700 mb-1'>Study Name</label>
          <input
            type='text'
            value={name()}
            onInput={e => setName(e.target.value)}
            class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            placeholder='Enter study name'
          />
        </div>

        {/* Citation Information - Collapsible */}
        <div class='border-t border-gray-200 pt-4'>
          <Collapsible
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
                  rows={2}
                />
              </div>
            </div>
          </Collapsible>
        </div>

        {/* Reviewer Assignments */}
        <div class='border-t border-gray-200 pt-4'>
          <h3 class='text-sm font-medium text-gray-900 mb-3 flex items-center gap-2'>
            <BiRegularUser class='w-4 h-4' />
            Reviewer Assignments
          </h3>
          <div class='grid grid-cols-2 gap-4'>
            <Select
              label='Reviewer 1'
              items={memberItems()}
              value={reviewer1()}
              onChange={setReviewer1}
              placeholder='Unassigned'
              disabledValues={reviewer2() ? [reviewer2()] : []}
              inDialog
            />
            <Select
              label='Reviewer 2'
              items={memberItems()}
              value={reviewer2()}
              onChange={setReviewer2}
              placeholder='Unassigned'
              disabledValues={reviewer1() ? [reviewer1()] : []}
              inDialog
            />
          </div>
          <Show when={members().length === 0}>
            <p class='text-sm text-gray-500 mt-2'>
              No team members available. Add members to the project first.
            </p>
          </Show>
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
