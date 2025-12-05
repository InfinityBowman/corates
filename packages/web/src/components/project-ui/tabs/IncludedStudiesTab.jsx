import { For, Show, createSignal } from 'solid-js';
import { AiOutlineBook, AiOutlineFileSync } from 'solid-icons/ai';
import { BiRegularImport, BiRegularEdit, BiRegularUpload } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { FiTrash2 } from 'solid-icons/fi';
import StudyForm from '../StudyForm.jsx';
import { showToast } from '@components/zag/Toast.jsx';

export default function IncludedStudiesTab(props) {
  return (
    <div class='space-y-4'>
      {/* Add Studies Section - Import button and StudyForm side by side */}
      <Show when={props.hasData()}>
        <div class='flex gap-4 items-start'>
          {/* Study Form / Drop Zone */}
          <div class='flex-1'>
            <StudyForm
              onSubmit={props.onCreateStudy}
              onCancel={() => props.onSetShowStudyForm(false)}
              onExpand={() => props.onSetShowStudyForm(true)}
              expanded={props.showStudyForm()}
              loading={props.creatingStudy()}
              hasExistingStudies={props.studies().length > 0}
            />
          </div>
          {/* Import from Reference Manager Button */}
          <button
            type='button'
            onClick={() => props.onOpenImportModal?.()}
            class='inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shrink-0'
          >
            <BiRegularImport class='w-4 h-4' />
            Import References
          </button>
        </div>
      </Show>

      <Show when={!props.hasData()} fallback={null}>
        <div class='text-center py-12 bg-gray-50 rounded-lg'>
          <p class='text-gray-400'>Loading studies...</p>
        </div>
      </Show>

      {/* Study count */}
      <div class='flex items-center justify-between'>
        <p class='text-sm text-gray-500'>
          {props.studies().length} {props.studies().length === 1 ? 'study' : 'studies'} in this
          project
        </p>
      </div>

      <Show
        when={props.studies().length > 0}
        fallback={
          <Show when={props.hasData()}>
            <div class='text-center py-12 bg-gray-50 rounded-lg'>
              <AiOutlineBook class='w-12 h-12 text-gray-300 mx-auto mb-4' />
              <p class='text-gray-500'>No studies added yet. Add your first study above.</p>
            </div>
          </Show>
        }
      >
        <div class='bg-gray-50 rounded-lg divide-y divide-gray-200'>
          <For each={props.studies()}>
            {study => {
              const [editing, setEditing] = createSignal(false);
              const [editName, setEditName] = createSignal('');
              const [uploading, setUploading] = createSignal(false);
              let fileInputRef;

              // Get assigned reviewers from study-level assignments
              const assignedReviewers = () => {
                const reviewers = [];
                if (study.reviewer1) reviewers.push(props.getAssigneeName(study.reviewer1));
                if (study.reviewer2) reviewers.push(props.getAssigneeName(study.reviewer2));
                return reviewers;
              };
              const hasAssignedReviewers = () => study.reviewer1 || study.reviewer2;

              // Collect all unique assignees from checklists (for backward compatibility)
              const checklistAssignees = () => {
                const uniqueAssignees = new Map();
                for (const checklist of study.checklists || []) {
                  if (checklist.assigneeId) {
                    uniqueAssignees.set(
                      checklist.assigneeId,
                      props.getAssigneeName(checklist.assigneeId),
                    );
                  }
                }
                return Array.from(uniqueAssignees.values());
              };

              // Check if study has PDFs
              const hasPdfs = () => study.pdfs && study.pdfs.length > 0;
              const firstPdf = () => (hasPdfs() ? study.pdfs[0] : null);

              // Start editing the study name
              const startEditing = () => {
                setEditName(study.name || '');
                setEditing(true);
              };

              // Save the edited name
              const saveEdit = () => {
                const newName = editName().trim();
                if (newName && newName !== study.name) {
                  props.onUpdateStudy?.(study.id, { name: newName });
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

              // Handle PDF file selection
              const handleFileSelect = async e => {
                const file = e.target.files?.[0];
                if (!file || file.type !== 'application/pdf') {
                  showToast.error('Invalid File', 'Please select a PDF file');
                  return;
                }

                setUploading(true);
                try {
                  await props.onUploadPdf?.(study.id, file);
                } catch (err) {
                  console.error('Error uploading PDF:', err);
                  showToast.error('Upload Failed', 'Failed to upload PDF');
                } finally {
                  setUploading(false);
                  if (fileInputRef) fileInputRef.value = '';
                }
              };

              return (
                <div class='p-4 flex items-center justify-between'>
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='application/pdf'
                    class='hidden'
                    onChange={handleFileSelect}
                  />
                  <div class='flex-1 min-w-0'>
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
                            class='text-gray-900 font-medium border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            autofocus
                          />
                        }
                      >
                        <p class='text-gray-900 font-medium truncate'>
                          {study.name || 'Untitled Study'}
                        </p>
                        <button
                          onClick={startEditing}
                          class='p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors'
                          title='Edit study name'
                        >
                          <BiRegularEdit class='w-4 h-4' />
                        </button>
                      </Show>
                    </div>
                    {/* Author/Year citation */}
                    <Show when={study.firstAuthor || study.publicationYear}>
                      <p class='text-xs text-gray-600'>
                        <span class='font-medium'>{study.firstAuthor || 'Unknown'}</span>
                        {study.publicationYear && ` (${study.publicationYear})`}
                        <Show when={study.journal}>
                          <span class='mx-1'>-</span>
                          <span class='italic'>{study.journal}</span>
                        </Show>
                      </p>
                    </Show>
                  </div>
                  <div class='flex items-center gap-2 ml-4'>
                    {/* Assigned reviewers from random assignment */}
                    <Show when={hasAssignedReviewers()}>
                      <div class='flex flex-wrap gap-1 justify-end'>
                        <For each={assignedReviewers()}>
                          {name => (
                            <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                              {name}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                    {/* Fallback: show checklist assignees if no study-level reviewers */}
                    <Show when={!hasAssignedReviewers()}>
                      <Show
                        when={checklistAssignees().length > 0}
                        fallback={
                          <span class='text-sm text-gray-400 italic'>No reviewers assigned</span>
                        }
                      >
                        <div class='flex flex-wrap gap-1 justify-end'>
                          <For each={checklistAssignees()}>
                            {name => (
                              <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                                {name}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                    </Show>
                    {/* PDF View/Upload buttons */}
                    <Show
                      when={hasPdfs()}
                      fallback={
                        <button
                          onClick={() => fileInputRef?.click()}
                          disabled={uploading()}
                          class='inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200 transition-colors gap-1 disabled:opacity-50'
                          title='Add PDF'
                        >
                          <BiRegularUpload class='w-3.5 h-3.5' />
                          {uploading() ? 'Uploading...' : 'Add PDF'}
                        </button>
                      }
                    >
                      <button
                        onClick={() => props.onViewPdf?.(study.id, firstPdf())}
                        class='inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200 transition-colors gap-1'
                        title='View PDF'
                      >
                        <CgFileDocument class='w-3.5 h-3.5' />
                        PDF
                      </button>
                      <button
                        onClick={() => fileInputRef?.click()}
                        disabled={uploading()}
                        class='p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50'
                        title='Change PDF'
                      >
                        <AiOutlineFileSync class='w-3.5 h-3.5' />
                      </button>
                    </Show>
                    {/* Delete button */}
                    <button
                      onClick={() => props.onDeleteStudy?.(study.id)}
                      class='p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors'
                      title='Delete Study'
                    >
                      <FiTrash2 class='w-4 h-4' />
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
