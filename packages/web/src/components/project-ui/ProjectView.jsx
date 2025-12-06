/**
 * ProjectView - Main view for a single project
 * Displays tabs for overview, included studies, in-progress, reconciliation, and completed
 */

import { createSignal, createEffect, createMemo, Show, onCleanup, batch } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import useProject from '@primitives/useProject.js';
import projectStore from '@primitives/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { uploadPdf } from '@api/pdf-api.js';
import { cachePdf } from '@primitives/pdfCache.js';
import { useConfirmDialog } from '@components/zag/Dialog.jsx';
import { Tabs } from '@components/zag/Tabs.jsx';
import { BiRegularHome } from 'solid-icons/bi';
import { BsListTask } from 'solid-icons/bs';
import { CgArrowsExchange } from 'solid-icons/cg';
import { AiFillCheckCircle, AiOutlineBook } from 'solid-icons/ai';

// Extracted handler hooks
import useProjectStudyHandlers from '@primitives/useProjectStudyHandlers.js';
import useProjectChecklistHandlers from '@primitives/useProjectChecklistHandlers.js';
import useProjectPdfHandlers from '@primitives/useProjectPdfHandlers.js';
import useProjectMemberHandlers from '@primitives/useProjectMemberHandlers.js';

// Components
import AddMemberModal from './AddMemberModal.jsx';
import ProjectHeader from './ProjectHeader.jsx';
import OverviewTab from './tabs/OverviewTab.jsx';
import IncludedStudiesTab from './tabs/IncludedStudiesTab.jsx';
import InProgressTab from './tabs/InProgressTab.jsx';
import ReadyToReconcileTab from './tabs/ReadyToReconcileTab.jsx';
import CompletedTab from './tabs/CompletedTab.jsx';
import ReferenceImportModal from './ReferenceImportModal.jsx';
import GoogleDrivePickerModal from './GoogleDrivePickerModal.jsx';

export default function ProjectView() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useBetterAuth();
  const confirmDialog = useConfirmDialog();

  // UI state signals
  const [showStudyForm, setShowStudyForm] = createSignal(false);
  const [creatingStudy, setCreatingStudy] = createSignal(false);
  const [showChecklistForm, setShowChecklistForm] = createSignal(null);
  const [creatingChecklist, setCreatingChecklist] = createSignal(false);
  const [showAddMemberModal, setShowAddMemberModal] = createSignal(false);
  const [showReferenceImportModal, setShowReferenceImportModal] = createSignal(false);
  const [showGoogleDriveModal, setShowGoogleDriveModal] = createSignal(false);
  const [googleDriveTargetStudyId, setGoogleDriveTargetStudyId] = createSignal(null);

  // Y.js hook for write operations
  const projectActions = useProject(params.projectId);
  const { connect, disconnect, getChecklistData, createStudy, addPdfToStudy } = projectActions;

  // Read data from store
  const studies = () => projectStore.getStudies(params.projectId);
  const members = () => projectStore.getMembers(params.projectId);
  const meta = () => projectStore.getMeta(params.projectId);
  const connectionState = () => projectStore.getConnectionState(params.projectId);
  const hasData = () => connectionState().synced || studies().length > 0;

  // Derived state
  const userRole = createMemo(() => {
    const currentUser = user();
    if (!currentUser) return null;
    const member = members().find(m => m.userId === currentUser.id);
    return member?.role || null;
  });
  const isOwner = () => userRole() === 'owner';

  // Extract handlers using custom hooks
  const studyHandlers = useProjectStudyHandlers({
    projectId: params.projectId,
    user,
    studies,
    meta,
    projectActions,
    confirmDialog,
    navigate,
    setShowStudyForm,
    setCreatingStudy,
    setShowChecklistForm,
    setCreatingChecklist,
    setShowReferenceImportModal,
  });

  const checklistHandlers = useProjectChecklistHandlers({
    projectId: params.projectId,
    projectActions,
    confirmDialog,
    navigate,
    setShowChecklistForm,
    setCreatingChecklist,
  });

  const pdfHandlers = useProjectPdfHandlers({
    projectId: params.projectId,
    user,
    studies,
    projectActions,
    setShowGoogleDriveModal,
    setGoogleDriveTargetStudyId,
    googleDriveTargetStudyId,
  });

  const memberHandlers = useProjectMemberHandlers({
    projectId: params.projectId,
    user,
    confirmDialog,
    navigate,
  });

  // Connect to Y.js on mount
  createEffect(() => {
    if (params.projectId) connect();
  });

  // Store pending data from navigation state
  const [pendingPdfs, setPendingPdfs] = createSignal(location.state?.pendingPdfs || null);
  const [pendingRefs, setPendingRefs] = createSignal(location.state?.pendingRefs || null);

  // Process pending PDFs from project creation
  createEffect(() => {
    const state = connectionState();
    const pdfs = pendingPdfs();
    if (!state.synced || !params.projectId || !Array.isArray(pdfs) || pdfs.length === 0) return;

    batch(() => {
      setPendingPdfs(null);
      window.history.replaceState({}, '', window.location.pathname);
    });

    for (const pdf of pdfs) {
      const studyId = createStudy(pdf.title, '');
      if (studyId && pdf.data) {
        const arrayBuffer = new Uint8Array(pdf.data).buffer;
        uploadPdf(params.projectId, studyId, arrayBuffer, pdf.fileName)
          .then(result => {
            cachePdf(params.projectId, studyId, result.fileName, arrayBuffer).catch(console.warn);
            addPdfToStudy(studyId, {
              key: result.key,
              fileName: result.fileName,
              size: result.size,
              uploadedBy: user()?.id,
              uploadedAt: Date.now(),
            });
          })
          .catch(err => console.error('Error uploading PDF for new study:', err));
      }
    }
  });

  // Process pending references from project creation
  createEffect(() => {
    const state = connectionState();
    const refs = pendingRefs();
    if (!state.synced || !params.projectId || !Array.isArray(refs) || refs.length === 0) return;

    batch(() => {
      setPendingRefs(null);
      window.history.replaceState({}, '', window.location.pathname);
    });

    for (const ref of refs) {
      createStudy(ref.title, ref.metadata?.abstract || '', ref.metadata || {});
    }
  });

  onCleanup(() => disconnect());

  // Helper functions
  const getAssigneeName = userId => {
    if (!userId) return 'Unassigned';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  };

  // Tab configuration - static to prevent re-renders
  const tabDefinitions = [
    { value: 'overview', label: 'Overview', icon: <BiRegularHome class='w-4 h-4' /> },
    {
      value: 'included-studies',
      label: 'Included Studies',
      icon: <AiOutlineBook class='w-4 h-4' />,
      getCount: () => studies().length,
    },
    { value: 'in-progress', label: 'In Progress', icon: <BsListTask class='w-4 h-4' /> },
    {
      value: 'ready-to-reconcile',
      label: 'Ready to Reconcile',
      icon: <CgArrowsExchange class='w-4 h-4' />,
    },
    { value: 'completed', label: 'Completed', icon: <AiFillCheckCircle class='w-4 h-4' /> },
  ];

  const validTabs = [
    'overview',
    'included-studies',
    'in-progress',
    'ready-to-reconcile',
    'completed',
  ];
  const tabFromUrl = () => {
    const tab = new URLSearchParams(location.search).get('tab');
    return validTabs.includes(tab) ? tab : 'overview';
  };

  const handleTabChange = value => {
    const searchParams = new URLSearchParams(location.search);
    value === 'overview' ? searchParams.delete('tab') : searchParams.set('tab', value);
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, { replace: true });
  };

  return (
    <div class='p-6 max-w-4xl mx-auto'>
      <ProjectHeader
        name={meta()?.name}
        description={meta()?.description}
        userRole={userRole()}
        isConnected={connectionState().connected}
        isOwner={isOwner()}
        onBack={() => navigate('/dashboard')}
        onDeleteProject={memberHandlers.handleDeleteProject}
      />

      <Tabs tabs={tabDefinitions} value={tabFromUrl()} onValueChange={handleTabChange}>
        {tabValue => (
          <>
            <Show when={tabValue === 'overview'}>
              <OverviewTab
                studies={studies}
                members={members}
                meta={meta}
                isOwner={isOwner}
                currentUserId={user()?.id}
                getChecklistData={getChecklistData}
                onAddMember={() => setShowAddMemberModal(true)}
                onRemoveMember={memberHandlers.handleRemoveMember}
                onAssignReviewers={studyHandlers.handleUpdateStudy}
                onUpdateSettings={projectActions.updateProjectSettings}
                onApplyNamingToAll={studyHandlers.handleApplyNamingToAll}
              />
            </Show>

            <Show when={tabValue === 'included-studies'}>
              <IncludedStudiesTab
                studies={studies}
                getAssigneeName={getAssigneeName}
                hasData={hasData}
                showStudyForm={showStudyForm}
                creatingStudy={creatingStudy}
                onSetShowStudyForm={setShowStudyForm}
                onAddStudies={studyHandlers.handleAddStudies}
                onUpdateStudy={studyHandlers.handleUpdateStudy}
                onDeleteStudy={studyHandlers.handleDeleteStudy}
                onViewPdf={pdfHandlers.handleViewPdf}
                onUploadPdf={pdfHandlers.handleUploadPdf}
                onOpenGoogleDrive={pdfHandlers.handleOpenGoogleDrive}
              />
            </Show>

            <Show when={tabValue === 'in-progress'}>
              <InProgressTab
                studies={studies}
                members={members}
                projectId={params.projectId}
                currentUserId={user()?.id}
                hasData={hasData}
                showStudyForm={showStudyForm}
                creatingStudy={creatingStudy}
                showChecklistForm={showChecklistForm}
                creatingChecklist={creatingChecklist}
                getAssigneeName={getAssigneeName}
                onSetShowStudyForm={setShowStudyForm}
                onSetShowChecklistForm={setShowChecklistForm}
                onCreateStudy={studyHandlers.handleCreateStudy}
                onCreateChecklist={checklistHandlers.handleCreateChecklist}
                onUpdateStudy={studyHandlers.handleUpdateStudy}
                onDeleteStudy={studyHandlers.handleDeleteStudy}
                onUpdateChecklist={checklistHandlers.handleUpdateChecklist}
                onDeleteChecklist={checklistHandlers.handleDeleteChecklist}
                onOpenChecklist={checklistHandlers.openChecklist}
                onOpenReconciliation={checklistHandlers.openReconciliation}
                onViewPdf={pdfHandlers.handleViewPdf}
                onUploadPdf={pdfHandlers.handleUploadPdf}
                onOpenImportModal={() => setShowReferenceImportModal(true)}
              />
            </Show>

            <Show when={tabValue === 'ready-to-reconcile'}>
              <ReadyToReconcileTab />
            </Show>

            <Show when={tabValue === 'completed'}>
              <CompletedTab />
            </Show>
          </>
        )}
      </Tabs>

      <AddMemberModal
        isOpen={showAddMemberModal()}
        onClose={() => setShowAddMemberModal(false)}
        projectId={params.projectId}
      />

      <ReferenceImportModal
        open={showReferenceImportModal()}
        onClose={() => setShowReferenceImportModal(false)}
        onImport={studyHandlers.handleImportReferences}
      />

      <GoogleDrivePickerModal
        open={showGoogleDriveModal()}
        onClose={() => {
          setShowGoogleDriveModal(false);
          setGoogleDriveTargetStudyId(null);
        }}
        projectId={params.projectId}
        studyId={googleDriveTargetStudyId()}
        onImportSuccess={pdfHandlers.handleGoogleDriveImportSuccess}
      />

      <confirmDialog.ConfirmDialogComponent />
    </div>
  );
}
