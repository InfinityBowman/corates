/**
 * StudyCard component - Displays a single study with its checklists and controls for
 * managing PDFs, editing the study name, and creating checklists.
 *
 * Props
 * @param {Object} props - Component props
 * @param {Object} props.study - The study object to display
 * @param {string} props.study.name - The display name of the study
 * @param {Array<Object>} [props.study.pdfs] - Array of PDF objects for the study (if any)
 * @param {string} [props.study.firstAuthor] - First author for the study citation line
 * @param {string|number} [props.study.publicationYear] - Publication year for the study
 * @param {string} [props.study.journal] - Journal name for the study
 * @param {Array<Object>} [props.study.checklists] - Array of checklist objects attached to this study
 * @param {Array<Object>} [props.members] - List of project members used to populate assignee dropdowns
 * @param {string|number} [props.currentUserId] - Current user id used to pre-select assignee in forms
 * @param {boolean} [props.showChecklistForm] - Whether the create-checklist form is visible
 * @param {boolean} [props.hideAddChecklist] - If true, hide the "Add Checklist" button
 * @param {boolean} [props.hideManagementActions] - If true, hide edit/upload/delete buttons
 * @param {boolean} [props.creatingChecklist] - Loading state for checklist creation
 * @param {function(type: string, assigneeId: string|number)} props.onAddChecklist - Creates a new checklist for a study
 * @param {function(File): Promise} [props.onUploadPdf] - Upload handler for PDF files; should accept a File and return a Promise
 * @param {function(Object)} [props.onUpdateStudy] - Update the study (partial update object expected)
 * @param {function(): void} [props.onDeleteStudy] - Deletes the study
 * @param {function(Object): void} [props.onViewPdf] - Called to open/view a PDF (passed a PDF object from study.pdfs)
 * @param {function(): void} [props.onToggleChecklistForm] - Toggles visibility for the checklist creation form
 * @param {function(checklistId: string|number): void} [props.onOpenChecklist] - Open a specific checklist for editing/review
 * @param {function(checklistId: string|number, updates: Object): void} [props.onUpdateChecklist] - Update checklist metadata
 * @param {function(checklistId: string|number): void} [props.onDeleteChecklist] - Delete a checklist
 * @param {function(assigneeId: string|number): string} [props.getAssigneeName] - Get member display name by id
 *
 * Behavior
 * - Renders a card header with the study title and optional citation line
 * - Shows a View / Add / Change PDF button depending on whether PDFs exist
 * - Allows editing the study name inline and saving changes via `onUpdateStudy`
 * - Allows creating new checklists via an `Add Checklist` button and `ChecklistForm`
 * - Renders existing checklists using `ChecklistRow` and forwards checklist actions
 */

import { For, Show, createSignal } from 'solid-js';
import { CgFileDocument } from 'solid-icons/cg';
import { BiRegularUpload, BiRegularEdit } from 'solid-icons/bi';
import { AiOutlineFileSync } from 'solid-icons/ai';
import { showToast } from '@components/zag/Toast.jsx';
import ChecklistForm from './ChecklistForm.jsx';
import ChecklistRow from './ChecklistRow.jsx';

export default function StudyCard(props) {
  let fileInputRef;
  const [uploading, setUploading] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [editName, setEditName] = createSignal('');

  const handleCreateChecklist = (type, assigneeId) => {
    props.onAddChecklist(type, assigneeId);
  };

  // Check if study has PDFs
  const hasPdfs = () => props.study.pdfs && props.study.pdfs.length > 0;
  const firstPdf = () => (hasPdfs() ? props.study.pdfs[0] : null);

  // Handle PDF file selection
  const handleFileSelect = async e => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      showToast.error('Invalid File', 'Please select a PDF file');
      return;
    }

    setUploading(true);
    try {
      await props.onUploadPdf?.(file);
    } catch (err) {
      console.error('Error uploading PDF:', err);
      showToast.error('Upload Failed', 'Failed to upload PDF');
    } finally {
      setUploading(false);
      // Reset the input so the same file can be selected again
      if (fileInputRef) fileInputRef.value = '';
    }
  };

  // Start editing the study name
  const startEditing = () => {
    setEditName(props.study.name);
    setEditing(true);
  };

  // Save the edited name
  const saveEdit = () => {
    const newName = editName().trim();
    if (newName && newName !== props.study.name) {
      props.onUpdateStudy?.({ name: newName });
    }
    setEditing(false);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditing(false);
    setEditName('');
  };

  // Handle key press in edit input
  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  return (
    <div class='bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden'>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type='file'
        accept='application/pdf'
        class='hidden'
        onChange={handleFileSelect}
      />

      {/* Study Header */}
      <div class='p-4 border-b border-gray-200 bg-gray-50'>
        <div class='flex items-center justify-between'>
          <div class='flex-1'>
            <div class='flex items-center gap-2'>
              <Show
                when={!editing()}
                fallback={
                  <input
                    type='text'
                    value={editName()}
                    onInput={e => setEditName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={saveEdit}
                    class='text-lg font-semibold text-gray-900 border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    autofocus
                  />
                }
              >
                <h3 class='text-lg font-semibold text-gray-900'>{props.study.name}</h3>
                <Show when={!props.hideManagementActions}>
                  <button
                    onClick={startEditing}
                    class='p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors'
                    title='Edit study name'
                  >
                    <BiRegularEdit class='w-4 h-4' />
                  </button>
                </Show>
              </Show>
            </div>
            {/* Author/Year citation line */}
            <Show when={props.study.firstAuthor || props.study.publicationYear}>
              <p class='text-sm text-gray-600 mt-0.5'>
                <span class='font-medium'>{props.study.firstAuthor || 'Unknown'}</span>
                {props.study.publicationYear && ` (${props.study.publicationYear})`}
                <Show when={props.study.journal}>
                  <span class='mx-1'>-</span>
                  <span class='italic text-gray-500'>{props.study.journal}</span>
                </Show>
              </p>
            </Show>
          </div>
          <div class='flex items-center gap-2'>
            <Show when={hasPdfs()}>
              <button
                onClick={() => props.onViewPdf?.(firstPdf())}
                class='inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors gap-1.5'
                title='View PDF'
              >
                <CgFileDocument class='w-4 h-4' />
                View PDF
              </button>
            </Show>
            <Show when={!hasPdfs() && !props.hideManagementActions}>
              <button
                onClick={() => fileInputRef?.click()}
                disabled={uploading()}
                class='inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors gap-1.5 disabled:opacity-50'
                title='Add PDF'
              >
                <BiRegularUpload class='w-4 h-4' />
                {uploading() ? 'Uploading...' : 'Add PDF'}
              </button>
            </Show>
            <Show when={hasPdfs() && !props.hideManagementActions}>
              <button
                onClick={() => fileInputRef?.click()}
                disabled={uploading()}
                class='inline-flex items-center p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'
                title='Change PDF'
              >
                <AiOutlineFileSync class='w-4 h-4' />
              </button>
            </Show>
            <Show when={!props.hideAddChecklist}>
              <button
                onClick={() => props.onToggleChecklistForm()}
                class='inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors gap-1'
              >
                <svg
                  class='w-4 h-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    stroke-linecap='round'
                    stroke-linejoin='round'
                    stroke-width='2'
                    d='M12 4v16m8-8H4'
                  />
                </svg>
                Add Checklist
              </button>
            </Show>
            <Show when={!props.hideManagementActions}>
              <button
                onClick={() => props.onDeleteStudy?.()}
                class='inline-flex items-center p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                title='Delete Study'
              >
                <svg
                  class='w-4 h-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    stroke-linecap='round'
                    stroke-linejoin='round'
                    stroke-width='2'
                    d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                  />
                </svg>
              </button>
            </Show>
          </div>
        </div>
      </div>

      {/* Add Checklist Form */}
      <Show when={props.showChecklistForm}>
        <ChecklistForm
          members={props.members}
          currentUserId={props.currentUserId}
          onSubmit={handleCreateChecklist}
          onCancel={() => props.onToggleChecklistForm()}
          loading={props.creatingChecklist}
        />
      </Show>

      {/* Checklists List */}
      <Show
        when={props.study.checklists?.length > 0}
        fallback={
          <div class='p-4 text-center text-gray-400 text-sm'>
            No checklists in this study yet
          </div>
        }
      >
        <div class='divide-y divide-gray-200'>
          <For each={props.study.checklists}>
            {checklist => (
              <ChecklistRow
                checklist={checklist}
                members={props.members}
                onOpen={() => props.onOpenChecklist(checklist.id)}
                onUpdate={updates => props.onUpdateChecklist?.(checklist.id, updates)}
                onDelete={() => props.onDeleteChecklist?.(checklist.id)}
                getAssigneeName={props.getAssigneeName}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
