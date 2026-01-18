/**
 * AllStudiesTab - Displays all studies in a project as expandable cards
 *
 * Uses projectActionsStore for mutations - leaf components call store directly.
 */

import { For, Show, createSignal, onMount } from 'solid-js';
import { AiOutlineBook } from 'solid-icons/ai';
import AddStudiesForm from '../add-studies/AddStudiesForm.jsx';
import GoogleDrivePickerModal from '../google-drive/GoogleDrivePickerModal.jsx';
import { StudyCard } from './study-card/index.js';
import AssignReviewersModal from './AssignReviewersModal.jsx';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useProjectContext } from '../ProjectContext.jsx';
import {
  saveFormState,
  getFormState,
  clearFormState,
  getRestoreParamsFromUrl,
  clearRestoreParamsFromUrl,
} from '@lib/formStatePersistence.js';

export default function AllStudiesTab() {
  const { projectId, getMember } = useProjectContext();

  // Local UI state
  const [showGoogleDriveModal, setShowGoogleDriveModal] = createSignal(false);
  const [googleDriveTargetStudyId, setGoogleDriveTargetStudyId] = createSignal(null);
  const [restoredState, setRestoredState] = createSignal(null);

  // Track which studies are expanded (by study ID)
  const [expandedStudies, setExpandedStudies] = createSignal(new Set());

  // Modal state
  const [showReviewersModal, setShowReviewersModal] = createSignal(false);
  const [editingStudy, setEditingStudy] = createSignal(null);

  // Check for and restore state on mount (after OAuth redirect)
  onMount(async () => {
    const restoreParams = getRestoreParamsFromUrl();
    if (restoreParams?.type === 'addStudies' && restoreParams.projectId === projectId) {
      try {
        const savedState = await getFormState('addStudies', projectId);
        if (savedState) {
          setRestoredState(savedState);
          await clearFormState('addStudies', projectId);
        }
      } catch (err) {
        console.error('Failed to restore form state:', err);
      }
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

  // Handler for adding studies (uses active project internally)
  const handleAddStudies = async studiesToAdd => {
    await projectActionsStore.study.addBatch(studiesToAdd);
  };

  // Google Drive handlers
  const handleOpenGoogleDrive = studyId => {
    setGoogleDriveTargetStudyId(studyId);
    setShowGoogleDriveModal(true);
  };

  const handleGoogleDriveImportSuccess = (file, studyId) => {
    // Use studyId from callback if provided, otherwise fall back to state
    const targetStudyId = studyId || googleDriveTargetStudyId();
    if (!targetStudyId) {
      console.error('No study ID available for Google Drive import');
      return;
    }
    projectActionsStore.pdf.handleGoogleDriveImport(targetStudyId, file);
  };

  // Modal handlers
  const handleOpenReviewersModal = study => {
    setEditingStudy(study);
    setShowReviewersModal(true);
  };

  const handleCloseReviewersModal = open => {
    if (!open) {
      setShowReviewersModal(false);
      setEditingStudy(null);
    }
  };

  const handleSaveReviewers = (studyId, updates) => {
    projectActionsStore.study.update(studyId, updates);
  };

  // Expand/collapse handlers
  const isStudyExpanded = studyId => expandedStudies().has(studyId);

  const toggleStudyExpanded = studyId => {
    setExpandedStudies(prev => {
      const next = new Set(prev);
      if (next.has(studyId)) {
        next.delete(studyId);
      } else {
        next.add(studyId);
      }
      return next;
    });
  };

  return (
    <div>
      {/* Add Studies Section */}
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
        <div class='rounded-lg bg-gray-50 py-12 text-center'>
          <p class='text-gray-400'>Loading studies...</p>
        </div>
      </Show>

      {/* Study count */}
      <div class='mb-2 flex items-center justify-between'>
        <p class='text-sm text-gray-500'>
          {studies().length} {studies().length === 1 ? 'study' : 'studies'} in this project
        </p>
      </div>

      {/* Study Cards - they handle mutations internally via store */}
      <Show
        when={studies().length > 0}
        fallback={
          <Show when={hasData()}>
            <div class='rounded-lg bg-gray-50 py-12 text-center'>
              <AiOutlineBook class='mx-auto mb-4 h-12 w-12 text-gray-300' />
              <p class='text-gray-500'>No studies added yet. Add your first study above.</p>
            </div>
          </Show>
        }
      >
        <div class='space-y-3'>
          <For each={studies()}>
            {study => (
              <StudyCard
                study={study}
                expanded={isStudyExpanded(study.id)}
                onToggleExpanded={() => toggleStudyExpanded(study.id)}
                getMember={getMember}
                onAssignReviewers={handleOpenReviewersModal}
                onOpenGoogleDrive={handleOpenGoogleDrive}
              />
            )}
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

      {/* Assign Reviewers Modal */}
      <AssignReviewersModal
        open={showReviewersModal()}
        onOpenChange={handleCloseReviewersModal}
        study={editingStudy()}
        projectId={projectId}
        onSave={handleSaveReviewers}
      />
    </div>
  );
}
