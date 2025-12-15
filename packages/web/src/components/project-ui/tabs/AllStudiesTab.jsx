import { For, Show, createSignal, onMount } from 'solid-js';
import { AiOutlineBook, AiOutlineFileSync } from 'solid-icons/ai';
import { BiRegularEdit, BiRegularUpload } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { FiTrash2 } from 'solid-icons/fi';
import { FaBrandsGoogleDrive } from 'solid-icons/fa';
import AddStudiesForm from '../AddStudiesForm.jsx';
import GoogleDrivePickerModal from '../google-drive/GoogleDrivePickerModal.jsx';
import { showToast } from '@components/zag/Toast.jsx';
import projectStore from '@/stores/projectStore.js';
import { useProjectContext } from '../ProjectContext.jsx';
import {
  saveFormState,
  getFormState,
  clearFormState,
  getRestoreParamsFromUrl,
  clearRestoreParamsFromUrl,
} from '@lib/formStatePersistence.js';

/**
 * AllStudiesTab - Displays all studies in a project
 */
export default function AllStudiesTab() {
  const { projectId, handlers, getAssigneeName } = useProjectContext();

  // Local UI state - managed here, not in parent
  const [showGoogleDriveModal, setShowGoogleDriveModal] = createSignal(false);
  const [googleDriveTargetStudyId, setGoogleDriveTargetStudyId] = createSignal(null);
  const [restoredState, setRestoredState] = createSignal(null);

  // Check for and restore state on mount (after OAuth redirect)
  onMount(async () => {
    const restoreParams = getRestoreParamsFromUrl();
    if (restoreParams?.type === 'addStudies' && restoreParams.projectId === projectId) {
      try {
        const savedState = await getFormState('addStudies', projectId);
        if (savedState) {
          // Pass studies state to AddStudiesForm via restoredState
          setRestoredState(savedState);

          // Clean up
          await clearFormState('addStudies', projectId);
        }
      } catch (err) {
        console.error('Failed to restore form state:', err);
      }

      // Clear the URL params
      clearRestoreParamsFromUrl();
    }
  });

  // Handler to save state before OAuth redirect
  const handleSaveState = async state => {
    await saveFormState('addStudies', state, projectId);
  };

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);
  const connectionState = () => projectStore.getConnectionState(projectId);
  const hasData = () => connectionState().synced || studies().length > 0;

  // Handler for adding studies - AddStudiesForm manages its own loading state
  const handleAddStudies = async studiesToAdd => {
    await handlers.studyHandlers.handleAddStudies(studiesToAdd);
  };

  const handleOpenGoogleDrive = studyId => {
    setGoogleDriveTargetStudyId(studyId);
    setShowGoogleDriveModal(true);
  };

  const handleGoogleDriveImportSuccess = file => {
    const studyId = googleDriveTargetStudyId();
    handlers.pdfHandlers.handleGoogleDriveImportSuccess(studyId, file);
  };
  return (
    <div class='space-y-4'>
      {/* Add Studies Section - Unified form with PDF upload, reference import, and DOI lookup */}
      <Show when={hasData()}>
        <AddStudiesForm
          projectId={projectId}
          formType='addStudies'
          initialState={restoredState()}
          onSaveState={handleSaveState}
          onAddStudies={handleAddStudies}
        />
      </Show>

      <Show when={!hasData()} fallback={null}>
        <div class='text-center py-12 bg-gray-50 rounded-lg'>
          <p class='text-gray-400'>Loading studies...</p>
        </div>
      </Show>

      {/* Study count */}
      <div class='flex items-center justify-between'>
        <p class='text-sm text-gray-500'>
          {studies().length} {studies().length === 1 ? 'study' : 'studies'} in this project
        </p>
      </div>

      <Show
        when={studies().length > 0}
        fallback={
          <Show when={hasData()}>
            <div class='text-center py-12 bg-gray-50 rounded-lg'>
              <AiOutlineBook class='w-12 h-12 text-gray-300 mx-auto mb-4' />
              <p class='text-gray-500'>No studies added yet. Add your first study above.</p>
            </div>
          </Show>
        }
      >
        <div class='bg-gray-50 rounded-lg divide-y divide-gray-200'>
          <For each={studies()}>
            {study => {
              const [editing, setEditing] = createSignal(false);
              const [editName, setEditName] = createSignal('');
              const [uploading, setUploading] = createSignal(false);
              let fileInputRef;

              // Get assigned reviewers from study-level assignments
              const assignedReviewers = () => {
                const reviewers = [];
                if (study.reviewer1) reviewers.push(getAssigneeName(study.reviewer1));
                if (study.reviewer2) reviewers.push(getAssigneeName(study.reviewer2));
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
                      getAssigneeName(checklist.assigneeId),
                    );
                  }
                }
                return Array.from(uniqueAssignees.values());
              };

              // Check if study has PDFs (uploaded or external URL)
              const hasPdfs = () => study.pdfs && study.pdfs.length > 0;
              const firstPdf = () => (hasPdfs() ? study.pdfs[0] : null);
              const hasExternalPdf = () => study.pdfUrl && !hasPdfs();

              // Start editing the study name
              const startEditing = () => {
                setEditName(study.name || '');
                setEditing(true);
              };

              // Save the edited name
              const saveEdit = () => {
                const newName = editName().trim();
                if (newName && newName !== study.name) {
                  handlers.studyHandlers.handleUpdateStudy(study.id, { name: newName });
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
                  await handlers.pdfHandlers.handleUploadPdf(study.id, file);
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
                        <Show
                          when={hasExternalPdf()}
                          fallback={
                            <div class='flex items-center gap-1'>
                              <button
                                onClick={() => fileInputRef?.click()}
                                disabled={uploading()}
                                class='inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200 transition-colors gap-1 disabled:opacity-50'
                                title='Upload PDF from computer'
                              >
                                <BiRegularUpload class='w-3.5 h-3.5' />
                                {uploading() ? 'Uploading...' : 'Add PDF'}
                              </button>
                              <button
                                onClick={() => handleOpenGoogleDrive(study.id)}
                                class='p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors'
                                title='Import from Google Drive'
                              >
                                <FaBrandsGoogleDrive class='w-3.5 h-3.5' />
                              </button>
                            </div>
                          }
                        >
                          {/* External PDF link from Unpaywall/open access */}
                          <a
                            href={study.pdfUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            class='inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 transition-colors gap-1'
                            title={`Open PDF via ${study.pdfSource || 'open access'}`}
                          >
                            <CgFileDocument class='w-3.5 h-3.5' />
                            PDF
                          </a>
                        </Show>
                      }
                    >
                      <button
                        onClick={() => handlers.pdfHandlers.handleViewPdf(study.id, firstPdf())}
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
                        title='Upload new PDF'
                      >
                        <AiOutlineFileSync class='w-3.5 h-3.5' />
                      </button>
                      <button
                        onClick={() => handleOpenGoogleDrive(study.id)}
                        class='p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors'
                        title='Import from Google Drive'
                      >
                        <FaBrandsGoogleDrive class='w-3.5 h-3.5' />
                      </button>
                    </Show>
                    {/* Delete button */}
                    <button
                      onClick={() => handlers.studyHandlers.handleDeleteStudy(study.id)}
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

      {/* Google Drive Modal */}
      <GoogleDrivePickerModal
        open={showGoogleDriveModal()}
        onClose={() => {
          setShowGoogleDriveModal(false);
          setGoogleDriveTargetStudyId(null);
        }}
        projectId={projectId}
        studyId={googleDriveTargetStudyId()}
        onImportSuccess={handleGoogleDriveImportSuccess}
      />
    </div>
  );
}
