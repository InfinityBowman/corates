/**
 * AllStudiesTab - Displays all studies in a project as expandable cards
 */

import { For, Show, createSignal, onMount } from 'solid-js';
import { AiOutlineBook } from 'solid-icons/ai';
import AddStudiesForm from '../AddStudiesForm.jsx';
import GoogleDrivePickerModal from '../google-drive/GoogleDrivePickerModal.jsx';
import { StudyCard } from './study-card/index.js';
import EditPdfMetadataModal from './EditPdfMetadataModal.jsx';
import AssignReviewersModal from './AssignReviewersModal.jsx';
import projectStore from '@/stores/projectStore.js';
import { useProjectContext } from '../ProjectContext.jsx';
import {
  saveFormState,
  getFormState,
  clearFormState,
  getRestoreParamsFromUrl,
  clearRestoreParamsFromUrl,
} from '@lib/formStatePersistence.js';

export default function AllStudiesTab() {
  const { projectId, handlers, getAssigneeName } = useProjectContext();

  // Local UI state
  const [showGoogleDriveModal, setShowGoogleDriveModal] = createSignal(false);
  const [googleDriveTargetStudyId, setGoogleDriveTargetStudyId] = createSignal(null);
  const [restoredState, setRestoredState] = createSignal(null);

  // Track which studies are expanded (by study ID)
  const [expandedStudies, setExpandedStudies] = createSignal(new Set());

  // Modal state
  const [showReviewersModal, setShowReviewersModal] = createSignal(false);
  const [showPdfMetadataModal, setShowPdfMetadataModal] = createSignal(false);
  const [editingStudy, setEditingStudy] = createSignal(null);
  const [editingPdf, setEditingPdf] = createSignal(null);
  const [editingPdfStudyId, setEditingPdfStudyId] = createSignal(null);

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

  // Handler for adding studies
  const handleAddStudies = async studiesToAdd => {
    await handlers.studyHandlers.handleAddStudies(studiesToAdd);
  };

  // Google Drive handlers
  const handleOpenGoogleDrive = studyId => {
    setGoogleDriveTargetStudyId(studyId);
    setShowGoogleDriveModal(true);
  };

  const handleGoogleDriveImportSuccess = file => {
    const studyId = googleDriveTargetStudyId();
    handlers.pdfHandlers.handleGoogleDriveImportSuccess(studyId, file);
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

  // PDF metadata modal handlers
  const handleOpenPdfMetadataModal = (studyId, pdf) => {
    setEditingPdfStudyId(studyId);
    setEditingPdf(pdf);
    setShowPdfMetadataModal(true);
  };

  const handleClosePdfMetadataModal = open => {
    if (!open) {
      setShowPdfMetadataModal(false);
      setEditingPdf(null);
      setEditingPdfStudyId(null);
    }
  };

  const handleSavePdfMetadata = (studyId, pdfId, metadata) => {
    handlers.pdfHandlers.handleUpdatePdfMetadata?.(studyId, pdfId, metadata);
  };

  // PDF handlers
  const handleViewPdf = (studyId, pdf) => {
    handlers.pdfHandlers.handleViewPdf(studyId, pdf);
  };

  const handleDownloadPdf = (studyId, pdf) => {
    handlers.pdfHandlers.handleDownloadPdf?.(studyId, pdf);
  };

  const handleUploadPdf = async (studyId, file) => {
    await handlers.pdfHandlers.handleUploadPdf(studyId, file);
  };

  const handleDeletePdf = (studyId, pdf) => {
    handlers.pdfHandlers.handleDeletePdf?.(studyId, pdf);
  };

  const handleTagChange = (studyId, pdfId, newTag) => {
    handlers.pdfHandlers.handleTagChange?.(studyId, pdfId, newTag);
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
        <div class='text-center py-12 bg-gray-50 rounded-lg'>
          <p class='text-gray-400'>Loading studies...</p>
        </div>
      </Show>

      {/* Study count */}
      <div class='flex items-center justify-between mb-2'>
        <p class='text-sm text-gray-500'>
          {studies().length} {studies().length === 1 ? 'study' : 'studies'} in this project
        </p>
      </div>

      {/* Study Cards */}
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
        <div class='space-y-3'>
          <For each={studies()}>
            {study => (
              <StudyCard
                study={study}
                expanded={isStudyExpanded(study.id)}
                onToggleExpanded={() => toggleStudyExpanded(study.id)}
                getAssigneeName={getAssigneeName}
                onUpdateStudy={handlers.studyHandlers.handleUpdateStudy}
                onAssignReviewers={handleOpenReviewersModal}
                onDeleteStudy={handlers.studyHandlers.handleDeleteStudy}
                onViewPdf={handleViewPdf}
                onDownloadPdf={handleDownloadPdf}
                onUploadPdf={handleUploadPdf}
                onDeletePdf={handleDeletePdf}
                onTagChange={handleTagChange}
                onEditPdfMetadata={handleOpenPdfMetadataModal}
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
        onSave={handlers.studyHandlers.handleUpdateStudy}
      />

      {/* Edit PDF Metadata Modal */}
      <EditPdfMetadataModal
        open={showPdfMetadataModal()}
        onOpenChange={handleClosePdfMetadataModal}
        pdf={editingPdf()}
        studyId={editingPdfStudyId()}
        onSave={handleSavePdfMetadata}
      />
    </div>
  );
}
