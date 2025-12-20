/**
 * ProjectView - Main view for a single project
 * Displays tabs for overview, all studies, to-do, reconciliation, and completed
 */

import { createSignal, createEffect, Show, onCleanup, batch } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import useProject from '@/primitives/useProject/index.js';
import projectStore from '@/stores/projectStore.js';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useBetterAuth } from '@api/better-auth-store.js';
import { uploadPdf, deletePdf } from '@api/pdf-api.js';
import { cachePdf } from '@primitives/pdfCache.js';
import { importFromGoogleDrive } from '@api/google-drive.js';
import { Tabs, showToast } from '@corates/ui';
import { BiRegularHome } from 'solid-icons/bi';
import { BsListTask } from 'solid-icons/bs';
import { CgArrowsExchange } from 'solid-icons/cg';
import { AiFillCheckCircle, AiOutlineBook } from 'solid-icons/ai';
import { isStudyInReconciliation } from '@/utils/reconciliation.js';

// Components
import { ProjectProvider } from './ProjectContext.jsx';
import ProjectHeader from './ProjectHeader.jsx';
import PdfPreviewPanel from './PdfPreviewPanel.jsx';
import { OverviewTab } from './overview-tab';
import { AllStudiesTab } from './all-studies-tab';
import { ToDoTab } from './todo-tab';
import { ReconcileTab } from './reconcile-tab';
import { CompletedTab } from './completed-tab';

export default function ProjectView() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useBetterAuth();

  // Y.js hook - connection is also registered with projectActionsStore
  const projectConnection = useProject(params.projectId);
  const { connect, disconnect } = projectConnection;

  // Read data from store (only what's needed at this level)
  const studies = () => projectStore.getStudies(params.projectId);
  const meta = () => projectStore.getMeta(params.projectId);
  const connectionState = () => projectStore.getConnectionState(params.projectId);

  // Set active project for action store (so methods don't need projectId)
  createEffect(() => {
    if (params.projectId) {
      projectActionsStore._setActiveProject(params.projectId);
      connect();
    }
  });

  // Clear active project on unmount
  onCleanup(() => {
    projectActionsStore._clearActiveProject();
    disconnect();
  });

  // Watch for access-denied errors and redirect to dashboard
  // These errors occur when: project deleted, user removed, or user never had access
  createEffect(() => {
    const state = connectionState();
    if (state.error && ACCESS_DENIED_ERRORS.includes(state.error)) {
      // Show appropriate toast message
      showToast.error('Access Denied', state.error);
      // Navigate to dashboard
      navigate('/dashboard', { replace: true });
    }
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
      // Use metadata if available (from merged ref/lookup data)
      const abstract = pdf.metadata?.abstract || '';
      const metadata = {
        ...(pdf.metadata || {}),
        doi: pdf.doi ?? pdf.metadata?.doi ?? null,
        importSource: pdf.metadata?.importSource || 'pdf',
      };
      const studyId = projectActionsStore.study.create(pdf.title, abstract, metadata);
      if (studyId && pdf.data) {
        const arrayBuffer = new Uint8Array(pdf.data).buffer;
        uploadPdf(params.projectId, studyId, arrayBuffer, pdf.fileName)
          .then(result => {
            cachePdf(params.projectId, studyId, result.fileName, arrayBuffer).catch(console.warn);
            try {
              // Extract PDF metadata from pdf.metadata to pass to the PDF object
              const pdfMetadata = pdf.metadata || {};
              projectActionsStore.pdf.addToStudy(studyId, {
                key: result.key,
                fileName: result.fileName,
                size: result.size,
                uploadedBy: user()?.id,
                uploadedAt: Date.now(),
                // Pass citation metadata from extracted metadata
                title: pdfMetadata.title || pdf.title || null,
                firstAuthor: pdfMetadata.firstAuthor || null,
                publicationYear: pdfMetadata.publicationYear || null,
                journal: pdfMetadata.journal || null,
                doi: pdf.doi ?? pdfMetadata.doi ?? null,
              });
            } catch (metaErr) {
              console.error('Failed to add PDF metadata:', metaErr);
              // Clean up orphaned file
              deletePdf(params.projectId, studyId, result.fileName).catch(console.warn);
            }
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
      projectActionsStore.study.create(ref.title, ref.metadata?.abstract || '', ref.metadata || {});
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
      // Use title from merged data if available, otherwise extract from filename
      const title = file.title || file.name.replace(/\\.pdf$/i, '');
      const abstract = file.metadata?.abstract || '';
      const metadata = {
        ...(file.metadata || {}),
        importSource: file.metadata?.importSource || file.importSource || 'google-drive',
      };
      const studyId = projectActionsStore.study.create(title, abstract, metadata);
      if (studyId && file.id) {
        importFromGoogleDrive(file.id, params.projectId, studyId)
          .then(result => {
            try {
              projectActionsStore.pdf.addToStudy(studyId, {
                key: result.file.key,
                fileName: result.file.fileName,
                size: result.file.size,
                uploadedBy: user()?.id,
                uploadedAt: Date.now(),
                source: 'google-drive',
              });
            } catch (metaErr) {
              console.error('Failed to add PDF metadata:', metaErr);
              // Clean up orphaned file
              deletePdf(params.projectId, studyId, result.file.fileName).catch(console.warn);
            }
          })
          .catch(err => console.error('Error importing Google Drive file:', err));
      }
    }
  });

  // Helper functions to count studies for tab badges
  const getToDoCount = () => {
    const userId = user()?.id;
    if (!userId) return 0;
    // Count studies where user is a reviewer and has non-completed checklists to work on
    return studies().filter(study => {
      if (study.reviewer1 !== userId && study.reviewer2 !== userId) return false;
      const checklists = study.checklists || [];
      const userChecklists = checklists.filter(c => c.assignedTo === userId);
      // Show if user has no checklist yet OR has a non-completed checklist
      return userChecklists.length === 0 || userChecklists.some(c => c.status !== 'completed');
    }).length;
  };

  const getReconcileCount = () => {
    return studies().filter(isStudyInReconciliation).length;
  };

  // Tab configuration
  const tabDefinitions = [
    { value: 'overview', label: 'Overview', icon: <BiRegularHome class='h-4 w-4' /> },
    {
      value: 'all-studies',
      label: 'All Studies',
      icon: <AiOutlineBook class='h-4 w-4' />,
    },
    {
      value: 'todo',
      label: 'To Do',
      icon: <BsListTask class='h-4 w-4' />,
      getCount: getToDoCount,
    },
    {
      value: 'reconcile',
      label: 'Reconcile',
      icon: <CgArrowsExchange class='h-4 w-4' />,
      getCount: getReconcileCount,
    },
    {
      value: 'completed',
      label: 'Completed',
      icon: <AiFillCheckCircle class='h-4 w-4' />,
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
    const queryString = newSearch ? `?${newSearch}` : '';
    navigate(`${location.pathname}${queryString}`, {
      replace: true,
    });
  };

  return (
    <div class='mx-auto max-w-7xl p-6'>
      <ProjectProvider projectId={params.projectId}>
        <ProjectHeader
          name={() => meta()?.name}
          description={() => meta()?.description}
          onRename={newName => projectActionsStore.project.rename(newName)}
          onUpdateDescription={desc => projectActionsStore.project.updateDescription(desc)}
          onBack={() => navigate('/dashboard')}
        />

        <Tabs tabs={tabDefinitions} value={tabFromUrl()} onValueChange={handleTabChange}>
          {tabValue => (
            <>
              <Show when={tabValue === 'overview'}>
                <OverviewTab />
              </Show>

              <Show when={tabValue === 'all-studies'}>
                <AllStudiesTab />
              </Show>

              <Show when={tabValue === 'todo'}>
                <ToDoTab />
              </Show>

              <Show when={tabValue === 'reconcile'}>
                <ReconcileTab />
              </Show>

              <Show when={tabValue === 'completed'}>
                <CompletedTab />
              </Show>
            </>
          )}
        </Tabs>
      </ProjectProvider>

      <PdfPreviewPanel />
    </div>
  );
}
