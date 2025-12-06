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

// Handler hooks - now with simplified API
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

export default function ProjectView() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useBetterAuth();
  const confirmDialog = useConfirmDialog();

  // Modal state that needs to be at this level (shared across tabs or triggered from header)
  const [showAddMemberModal, setShowAddMemberModal] = createSignal(false);
  const [showReferenceImportModal, setShowReferenceImportModal] = createSignal(false);

  // Y.js hook for write operations
  const projectActions = useProject(params.projectId);
  const { connect, disconnect, createStudy, addPdfToStudy } = projectActions;

  // Read data from store
  const studies = () => projectStore.getStudies(params.projectId);
  const members = () => projectStore.getMembers(params.projectId);
  const meta = () => projectStore.getMeta(params.projectId);
  const connectionState = () => projectStore.getConnectionState(params.projectId);

  // Derived state
  const userRole = createMemo(() => {
    const currentUser = user();
    if (!currentUser) return null;
    const member = members().find(m => m.userId === currentUser.id);
    return member?.role || null;
  });
  const isOwner = () => userRole() === 'owner';

  // Create handlers with simplified API - they read from store directly
  const studyHandlers = useProjectStudyHandlers(params.projectId, projectActions, confirmDialog);
  const checklistHandlers = useProjectChecklistHandlers(
    params.projectId,
    projectActions,
    confirmDialog,
  );
  const pdfHandlers = useProjectPdfHandlers(params.projectId, projectActions);
  const memberHandlers = useProjectMemberHandlers(params.projectId, confirmDialog);

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

  // Helper function for getting assignee names
  const getAssigneeName = userId => {
    if (!userId) return 'Unassigned';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  };

  // Tab configuration
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
                projectId={params.projectId}
                isOwner={isOwner()}
                studyHandlers={studyHandlers}
                memberHandlers={memberHandlers}
                projectActions={projectActions}
                onAddMember={() => setShowAddMemberModal(true)}
              />
            </Show>

            <Show when={tabValue === 'included-studies'}>
              <IncludedStudiesTab
                projectId={params.projectId}
                studyHandlers={studyHandlers}
                pdfHandlers={pdfHandlers}
                getAssigneeName={getAssigneeName}
              />
            </Show>

            <Show when={tabValue === 'in-progress'}>
              <InProgressTab
                projectId={params.projectId}
                checklistHandlers={checklistHandlers}
                pdfHandlers={pdfHandlers}
                getAssigneeName={getAssigneeName}
              />
            </Show>

            <Show when={tabValue === 'ready-to-reconcile'}>
              <ReadyToReconcileTab
                projectId={params.projectId}
                checklistHandlers={checklistHandlers}
                pdfHandlers={pdfHandlers}
                getAssigneeName={getAssigneeName}
              />
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

      <confirmDialog.ConfirmDialogComponent />
    </div>
  );
}
