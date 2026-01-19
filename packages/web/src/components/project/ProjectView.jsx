/**
 * ProjectView - Main view for a single project
 * Displays tabs for overview, all studies, to-do, reconciliation, and completed
 * Child routes (checklist, reconciliation) are rendered via props.children
 *
 * This component uses org-scoped routes and APIs.
 */

import { createSignal, createEffect, Show, onCleanup, batch, createMemo, For } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import useProject from '@/primitives/useProject/index.js';
import { useProjectOrgId } from '@primitives/useProjectOrgId.js';
import projectStore from '@/stores/projectStore.js';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useBetterAuth } from '@api/better-auth-store.js';
import { uploadPdf, deletePdf } from '@api/pdf-api.js';
import { cachePdf } from '@primitives/pdfCache.js';
import { importFromGoogleDrive } from '@api/google-drive.js';
import { showToast } from '@/components/ui/toast';
import { Tabs, TabsList, TabsTrigger, TabsContent, TabsIndicator } from '@/components/ui/tabs';
import { BiRegularHome } from 'solid-icons/bi';
import { BsListTask } from 'solid-icons/bs';
import { CgArrowsExchange } from 'solid-icons/cg';
import { AiFillCheckCircle, AiOutlineBook } from 'solid-icons/ai';
import { getChecklistCount } from '@/lib/checklist-domain.js';

// Components
import { ProjectProvider } from './ProjectContext.jsx';
import ProjectHeader from './ProjectHeader.jsx';
import PdfPreviewPanel from './PdfPreviewPanel.jsx';
import { OverviewTab } from './overview-tab/index.js';
import { AllStudiesTab } from './all-studies-tab/index.js';
import { ToDoTab } from './todo-tab/index.js';
import { ReconcileTab } from './reconcile-tab/index.js';
import { CompletedTab } from './completed-tab/index.js';
import { SectionErrorBoundary } from '@components/ErrorBoundary.jsx';

export default function ProjectView(props) {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useBetterAuth();

  // Get orgId from project data (for API calls)
  const orgId = useProjectOrgId(params.projectId);

  // Y.js hook - connection is also registered with projectActionsStore
  // No longer requires orgId for WebSocket connection (project-scoped)
  const projectConnection = useProject(params.projectId);
  const { connect, disconnect } = projectConnection;

  // Detect if we're on a child route (checklist or reconciliation)
  const isChildRoute = createMemo(() => {
    const path = location.pathname;
    return path.includes('/checklists/') || path.includes('/reconcile/');
  });

  // Read data from store (only what's needed at this level)
  const studies = () => projectStore.getStudies(params.projectId);
  const meta = () => projectStore.getMeta(params.projectId);
  const connectionState = () => projectStore.getConnectionState(params.projectId);

  // Set active project for action store (so methods don't need projectId/orgId)
  createEffect(() => {
    const pid = params.projectId;
    const oid = orgId();
    if (pid) {
      if (oid) {
        projectActionsStore._setActiveProject(pid, oid);
      }
      connect();
    }
  });

  // Clear active project on unmount
  onCleanup(() => {
    projectActionsStore._clearActiveProject();
    disconnect();
  });

  // Watch for access-denied errors and redirect to projects page
  createEffect(() => {
    const state = connectionState();
    if (state.error && ACCESS_DENIED_ERRORS.includes(state.error)) {
      showToast.error('Access Denied', state.error);
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
    const oid = orgId();
    if (!state.synced || !params.projectId || !oid || !Array.isArray(pdfs) || pdfs.length === 0)
      return;

    batch(() => {
      setPendingPdfs(null);
    });

    for (const pdf of pdfs) {
      // Use metadata if available (from merged ref/lookup data)
      const abstract = pdf.metadata?.abstract || '';
      // Use filename (without .pdf extension) as study name, extracted title as originalTitle
      const studyName = pdf.fileName ? pdf.fileName.replace(/\.pdf$/i, '') : 'Untitled Study';
      const metadata = {
        ...(pdf.metadata || {}),
        originalTitle: pdf.title || pdf.metadata?.title || null,
        doi: pdf.doi ?? pdf.metadata?.doi ?? null,
        importSource: pdf.metadata?.importSource || 'pdf',
      };
      const studyId = projectActionsStore.study.create(studyName, abstract, metadata);
      if (studyId && pdf.data) {
        const arrayBuffer = new Uint8Array(pdf.data).buffer;
        uploadPdf(oid, params.projectId, studyId, arrayBuffer, pdf.fileName)
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
              deletePdf(oid, params.projectId, studyId, result.fileName).catch(console.warn);
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
    const oid = orgId();
    if (
      !state.synced ||
      !params.projectId ||
      !oid ||
      !Array.isArray(driveFiles) ||
      driveFiles.length === 0
    )
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
              deletePdf(oid, params.projectId, studyId, result.file.fileName).catch(console.warn);
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
    return getChecklistCount(studies(), 'todo', userId);
  };

  const getReconcileCount = () => {
    return getChecklistCount(studies(), 'reconcile', null);
  };

  const getAllStudiesCount = () => {
    return studies().length;
  };

  const getCompletedCount = () => {
    return getChecklistCount(studies(), 'completed', null);
  };

  // Tab configuration
  const tabDefinitions = [
    { value: 'overview', label: 'Overview', icon: <BiRegularHome class='h-4 w-4' /> },
    {
      value: 'all-studies',
      label: 'All Studies',
      icon: <AiOutlineBook class='h-4 w-4' />,
      getCount: getAllStudiesCount,
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
      getCount: getCompletedCount,
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

  // Build back navigation path
  const backPath = () => '/dashboard';

  return (
    <ProjectProvider projectId={params.projectId} projectOps={projectConnection}>
      {/* Child routes (checklist, reconciliation) render via props.children */}
      <Show when={isChildRoute()}>{props.children}</Show>

      {/* Main project view with tabs */}
      <Show when={!isChildRoute()}>
        <div class='bg-background min-h-screen'>
          <Tabs value={tabFromUrl()} onValueChange={handleTabChange}>
            {/* Sticky header */}
            <header class='border-border bg-card sticky top-0 z-20 border-b'>
              <div class='mx-auto max-w-7xl px-6'>
                <ProjectHeader
                  name={() => meta()?.name}
                  description={() => meta()?.description}
                  onRename={newName => projectActionsStore.project.rename(newName)}
                  onUpdateDescription={desc => projectActionsStore.project.updateDescription(desc)}
                  onBack={() => navigate(backPath())}
                />
              </div>

              {/* Tabs navigation */}
              <div class='mx-auto max-w-7xl px-6'>
                <TabsList class='relative flex gap-1 overflow-x-auto pb-px'>
                  <For each={tabDefinitions}>
                    {tab => (
                      <TabsTrigger
                        value={tab.value}
                        class='group text-muted-foreground hover:bg-muted hover:text-secondary-foreground data-selected:text-foreground relative gap-2 rounded-t-lg px-4 py-2.5 transition-all'
                      >
                        <span class='opacity-60 transition-opacity group-data-selected:opacity-100'>
                          {tab.icon}
                        </span>
                        <span class='font-medium'>{tab.label}</span>
                        <Show when={tab.getCount}>
                          <span class='bg-secondary text-secondary-foreground group-data-selected:bg-primary-subtle group-data-selected:text-primary min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums transition-colors'>
                            {tab.getCount()}
                          </span>
                        </Show>
                      </TabsTrigger>
                    )}
                  </For>
                  <TabsIndicator class='bg-primary h-0.5 rounded-full' />
                </TabsList>
              </div>
            </header>

            {/* Main content area */}
            <main class='mx-auto max-w-7xl px-6 py-6'>
              <TabsContent value='overview' class='mt-0'>
                <SectionErrorBoundary name='Overview'>
                  <OverviewTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='all-studies' class='mt-0'>
                <SectionErrorBoundary name='All Studies'>
                  <AllStudiesTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='todo' class='mt-0'>
                <SectionErrorBoundary name='To-Do'>
                  <ToDoTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='reconcile' class='mt-0'>
                <SectionErrorBoundary name='Reconcile'>
                  <ReconcileTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='completed' class='mt-0'>
                <SectionErrorBoundary name='Completed'>
                  <CompletedTab />
                </SectionErrorBoundary>
              </TabsContent>
            </main>
          </Tabs>
        </div>

        <PdfPreviewPanel />
      </Show>
    </ProjectProvider>
  );
}
