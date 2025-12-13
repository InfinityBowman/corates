/**
 * ProjectView - Main view for a single project
 * Displays tabs for overview, all studies, to-do, reconciliation, and completed
 */

import { createSignal, createEffect, Show, onCleanup, batch } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import useProject from '@/primitives/useProject/index.js';
import projectStore from '@primitives/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { uploadPdf } from '@api/pdf-api.js';
import { cachePdf } from '@primitives/pdfCache.js';
import { importFromGoogleDrive } from '@api/google-drive.js';
import { useConfirmDialog } from '@components/zag/Dialog.jsx';
import { Tabs } from '@components/zag/Tabs.jsx';
import { BiRegularHome } from 'solid-icons/bi';
import { BsListTask } from 'solid-icons/bs';
import { CgArrowsExchange } from 'solid-icons/cg';
import { AiFillCheckCircle, AiOutlineBook } from 'solid-icons/ai';

// Handler hooks
import useProjectStudyHandlers from '@primitives/useProjectStudyHandlers.js';
import useProjectChecklistHandlers from '@primitives/useProjectChecklistHandlers.js';
import useProjectPdfHandlers from '@primitives/useProjectPdfHandlers.js';
import useProjectMemberHandlers from '@primitives/useProjectMemberHandlers.js';

// Components
import { ProjectProvider } from './ProjectContext.jsx';
import AddMemberModal from './AddMemberModal.jsx';
import ProjectHeader from './ProjectHeader.jsx';
import OverviewTab from './tabs/OverviewTab.jsx';
import IncludedStudiesTab from './tabs/AllStudiesTab.jsx';
import ToDoTab from './tabs/ToDoTab.jsx';
import ReadyToReconcileTab from './tabs/ReadyToReconcileTab.jsx';
import CompletedTab from './tabs/CompletedTab.jsx';

export default function ProjectView() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useBetterAuth();
  const confirmDialog = useConfirmDialog();

  // Modal state that needs to be at this level (shared across tabs or triggered from header)
  const [showAddMemberModal, setShowAddMemberModal] = createSignal(false);

  // Y.js hook for write operations
  const projectActions = useProject(params.projectId);
  const { connect, disconnect, createStudy, addPdfToStudy } = projectActions;

  // Read data from store (only what's needed at this level)
  const studies = () => projectStore.getStudies(params.projectId);
  const meta = () => projectStore.getMeta(params.projectId);
  const connectionState = () => projectStore.getConnectionState(params.projectId);

  // Create handlers
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

  // Retrieve pending data from projectStore (stored during project creation)
  const pendingData = projectStore.getPendingProjectData(params.projectId);
  const [pendingPdfs, setPendingPdfs] = createSignal(pendingData?.pendingPdfs || null);
  const [pendingRefs, setPendingRefs] = createSignal(pendingData?.pendingRefs || null);
  const [pendingDriveFiles, setPendingDriveFiles] = createSignal(pendingData?.driveFiles || null);

  // Process pending PDFs from project creation
  createEffect(() => {
    const state = connectionState();
    const pdfs = pendingPdfs();
    if (!state.synced || !params.projectId || !Array.isArray(pdfs) || pdfs.length === 0) return;

    batch(() => {
      setPendingPdfs(null);
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
    });

    for (const ref of refs) {
      createStudy(ref.title, ref.metadata?.abstract || '', ref.metadata || {});
    }
  });

  // Process pending Google Drive files from project creation
  createEffect(() => {
    const state = connectionState();
    const driveFiles = pendingDriveFiles();
    if (!state.synced || !params.projectId || !Array.isArray(driveFiles) || driveFiles.length === 0)
      return;

    batch(() => {
      setPendingDriveFiles(null);
    });

    for (const file of driveFiles) {
      const title = file.name.replace(/\.pdf$/i, '');
      const studyId = createStudy(title, '');
      if (studyId && file.id) {
        importFromGoogleDrive(file.id, params.projectId, studyId)
          .then(result => {
            addPdfToStudy(studyId, {
              key: result.file.key,
              fileName: result.file.fileName,
              size: result.file.size,
              uploadedBy: user()?.id,
              uploadedAt: Date.now(),
              source: 'google-drive',
            });
          })
          .catch(err => console.error('Error importing Google Drive file:', err));
      }
    }
  });

  onCleanup(() => disconnect());

  // Helper functions to count studies for tab badges
  const getToDoCount = () => {
    const userId = user()?.id;
    if (!userId) return 0;
    return studies().filter(study => study.reviewer1 === userId || study.reviewer2 === userId)
      .length;
  };

  const getReadyToReconcileCount = () => {
    return studies().filter(study => {
      const checklists = study.checklists || [];
      const completedChecklists = checklists.filter(c => c.status === 'completed');
      return completedChecklists.length === 2;
    }).length;
  };

  // Tab configuration
  const tabDefinitions = [
    { value: 'overview', label: 'Overview', icon: <BiRegularHome class='w-4 h-4' /> },
    {
      value: 'all-studies',
      label: 'All Studies',
      icon: <AiOutlineBook class='w-4 h-4' />,
    },
    {
      value: 'todo',
      label: 'To Do',
      icon: <BsListTask class='w-4 h-4' />,
      getCount: getToDoCount,
    },
    {
      value: 'ready-to-reconcile',
      label: 'Ready to Reconcile',
      icon: <CgArrowsExchange class='w-4 h-4' />,
      getCount: getReadyToReconcileCount,
    },
    {
      value: 'completed',
      label: 'Completed',
      icon: <AiFillCheckCircle class='w-4 h-4' />,
    },
  ];

  const tabFromUrl = () => {
    const tab = new URLSearchParams(location.search).get('tab');
    return tabDefinitions.map(tab => tab.value).includes(tab) ? tab : 'overview';
  };

  const handleTabChange = value => {
    const searchParams = new URLSearchParams(location.search);
    value === 'overview' ? searchParams.delete('tab') : searchParams.set('tab', value);
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
  };

  return (
    <div class='p-6 max-w-7xl mx-auto'>
      <ProjectProvider
        projectId={params.projectId}
        handlers={{ studyHandlers, checklistHandlers, pdfHandlers, memberHandlers }}
        projectActions={projectActions}
        onAddMember={() => setShowAddMemberModal(true)}
      >
        <ProjectHeader
          name={meta()?.name}
          description={meta()?.description}
          onRename={projectActions.renameProject}
          onBack={() => navigate('/dashboard')}
        />

        <Tabs tabs={tabDefinitions} value={tabFromUrl()} onValueChange={handleTabChange}>
          {tabValue => (
            <>
              <Show when={tabValue === 'overview'}>
                <OverviewTab onAddMember={() => setShowAddMemberModal(true)} />
              </Show>

              <Show when={tabValue === 'all-studies'}>
                <IncludedStudiesTab />
              </Show>

              <Show when={tabValue === 'todo'}>
                <ToDoTab />
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
      </ProjectProvider>

      <AddMemberModal
        isOpen={showAddMemberModal()}
        onClose={() => setShowAddMemberModal(false)}
        projectId={params.projectId}
      />

      <confirmDialog.ConfirmDialogComponent />
    </div>
  );
}
