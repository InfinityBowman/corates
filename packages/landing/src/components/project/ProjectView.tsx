/**
 * ProjectView - Main view for a single project
 * Establishes Yjs connection, processes pending data, renders tabbed interface.
 * Child routes (checklist, reconciliation) are rendered via Outlet.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from '@tanstack/react-router';
import {
  useProjectStore,
  selectStudies,
  selectMeta,
  selectConnectionState,
} from '@/stores/projectStore';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { ProjectGate } from '@/project';
import { project } from '@/project';
import { uploadPdf, deletePdf } from '@/api/pdf-api';
import { cachePdf } from '@/primitives/pdfCache.js';
import { bestEffort } from '@/lib/errorLogger.js';
import { importFromGoogleDrive } from '@/api/google-drive';
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  HomeIcon,
  BookOpenIcon,
  ListTodoIcon,
  ArrowRightLeftIcon,
  CheckCircleIcon,
} from 'lucide-react';
import { getChecklistCount } from '@/lib/checklist-domain.js';

import { ProjectHeader } from './ProjectHeader';
import { PdfPreviewPanel } from './PdfPreviewPanel';
import { SectionErrorBoundary } from './SectionErrorBoundary';

// Lazy tab components - stubs for now, real implementations in Phases B/C
import { OverviewTab } from './overview-tab/OverviewTab';
import { AllStudiesTab } from './all-studies-tab/AllStudiesTab';
import { ToDoTab } from './todo-tab/ToDoTab';
import { ReconcileTab } from './reconcile-tab/ReconcileTab';
import { CompletedTab } from './completed-tab/CompletedTab';

interface ProjectViewProps {
  projectId: string;
}

export function ProjectView({ projectId }: ProjectViewProps) {
  return (
    <ProjectGate projectId={projectId} fallback={<ProjectLoadingFallback />}>
      <ProjectViewInner projectId={projectId} />
    </ProjectGate>
  );
}

function ProjectLoadingFallback() {
  return (
    <div className='bg-background flex min-h-screen items-center justify-center'>
      <div className='text-muted-foreground text-sm'>Loading project...</div>
    </div>
  );
}

function ProjectViewInner({ projectId }: ProjectViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore(selectUser);
  const orgId = useProjectOrgId(projectId);

  const isChildRoute = useMemo(() => {
    const path = location.pathname;
    return path.includes('/checklists/') || path.includes('/reconcile/');
  }, [location.pathname]);

  const studies = useProjectStore(s => selectStudies(s, projectId));
  const meta = useProjectStore(s => selectMeta(s, projectId));
  const connectionState = useProjectStore(s => selectConnectionState(s, projectId));

  // Read pending data exactly once via lazy initializer (safe for StrictMode)
  const [pendingState] = useState(() => {
    const d = (useProjectStore.getState() as any).getPendingProjectData?.(projectId);
    return {
      pdfs: d?.pendingPdfs || null,
      refs: d?.pendingRefs || null,
      drive: d?.driveFiles || null,
    };
  });
  const [pendingPdfs, setPendingPdfs] = useState<any[] | null>(pendingState.pdfs);
  const [pendingRefs, setPendingRefs] = useState<any[] | null>(pendingState.refs);
  const [pendingDriveFiles, setPendingDriveFiles] = useState<any[] | null>(pendingState.drive);

  useEffect(() => {
    if (
      !connectionState.synced ||
      !projectId ||
      !orgId ||
      !Array.isArray(pendingPdfs) ||
      pendingPdfs.length === 0
    )
      return;
    const pdfs = pendingPdfs;
    setPendingPdfs(null); // eslint-disable-line react-hooks/set-state-in-effect -- one-time consumption

    for (const pdf of pdfs) {
      const studyName = pdf.fileName ? pdf.fileName.replace(/\.pdf$/i, '') : 'Untitled Study';
      const metadata = {
        ...(pdf.metadata || {}),
        originalTitle: pdf.title || pdf.metadata?.title || null,
        doi: pdf.doi ?? pdf.metadata?.doi ?? null,
        importSource: pdf.metadata?.importSource || 'pdf',
      };
      const studyId = project.study.create(studyName, pdf.metadata?.abstract || '', metadata);
      if (studyId && pdf.data) {
        const arrayBuffer = new Uint8Array(pdf.data).buffer;
        uploadPdf(orgId, projectId, studyId, arrayBuffer, pdf.fileName)
          .then(result => {
            bestEffort(cachePdf(projectId, studyId, result.fileName, arrayBuffer), {
              operation: 'cachePdf (pending upload)',
              projectId,
              studyId,
              fileName: result.fileName,
            });
            try {
              const pdfMetadata = pdf.metadata || {};
              project.pdf.addToStudy(studyId, {
                key: result.key,
                fileName: result.fileName,
                size: result.size,
                uploadedBy: user?.id,
                uploadedAt: Date.now(),
                title: pdfMetadata.title || pdf.title || null,
                firstAuthor: pdfMetadata.firstAuthor || null,
                publicationYear: pdfMetadata.publicationYear || null,
                journal: pdfMetadata.journal || null,
                doi: pdf.doi ?? pdfMetadata.doi ?? null,
              });
            } catch (metaErr) {
              console.error('Failed to add PDF metadata:', metaErr);
              bestEffort(deletePdf(orgId, projectId, studyId, result.fileName), {
                operation: 'deletePdf (pending upload rollback)',
                projectId,
                studyId,
                fileName: result.fileName,
              });
            }
          })
          .catch(err => console.error('Error uploading PDF for new study:', err));
      }
    }
  }, [connectionState.synced, projectId, orgId, pendingPdfs, user?.id]);

  useEffect(() => {
    if (
      !connectionState.synced ||
      !projectId ||
      !Array.isArray(pendingRefs) ||
      pendingRefs.length === 0
    )
      return;
    const refs = pendingRefs;
    setPendingRefs(null); // eslint-disable-line react-hooks/set-state-in-effect -- one-time consumption
    for (const ref of refs) {
      project.study.create(ref.title, ref.metadata?.abstract || '', ref.metadata || {});
    }
  }, [connectionState.synced, projectId, pendingRefs]);

  useEffect(() => {
    if (
      !connectionState.synced ||
      !projectId ||
      !orgId ||
      !Array.isArray(pendingDriveFiles) ||
      pendingDriveFiles.length === 0
    )
      return;
    const driveFiles = pendingDriveFiles;
    setPendingDriveFiles(null); // eslint-disable-line react-hooks/set-state-in-effect -- one-time consumption
    for (const file of driveFiles) {
      const title = file.title || file.name.replace(/\.pdf$/i, '');
      const metadata = {
        ...(file.metadata || {}),
        importSource: file.metadata?.importSource || file.importSource || 'google-drive',
      };
      const studyId = project.study.create(title, file.metadata?.abstract || '', metadata);
      if (studyId && file.id) {
        importFromGoogleDrive(file.id, projectId, studyId)
          .then((result: any) => {
            try {
              project.pdf.addToStudy(studyId, {
                key: result.file.key,
                fileName: result.file.fileName,
                size: result.file.size,
                uploadedBy: user?.id,
                uploadedAt: Date.now(),
                source: 'google-drive',
              });
            } catch (metaErr) {
              console.error('Failed to add PDF metadata:', metaErr);
              bestEffort(deletePdf(orgId, projectId, studyId, result.file.fileName), {
                operation: 'deletePdf (Google Drive rollback)',
                projectId,
                studyId,
                fileName: result.file.fileName,
              });
            }
          })
          .catch(err => console.error('Error importing Google Drive file:', err));
      }
    }
  }, [connectionState.synced, projectId, orgId, pendingDriveFiles, user?.id]);

  // Tab helpers
  const userId = user?.id;
  const getToDoCount = useCallback(() => {
    if (!userId) return 0;
    return getChecklistCount(studies, 'todo', userId);
  }, [studies, userId]);

  const getReconcileCount = useCallback(
    () => getChecklistCount(studies, 'reconcile', null),
    [studies],
  );
  const getAllStudiesCount = useCallback(() => studies.length, [studies]);
  const getCompletedCount = useCallback(
    () => getChecklistCount(studies, 'completed', null),
    [studies],
  );

  const tabFromUrl = useMemo(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    const validTabs = ['overview', 'all-studies', 'todo', 'reconcile', 'completed'];
    return validTabs.includes(tab || '') ? tab! : 'overview';
  }, [location.search]);

  const handleTabChange = useCallback(
    (value: string) => {
      const searchParams = new URLSearchParams(location.search);
      value === 'overview' ? searchParams.delete('tab') : searchParams.set('tab', value);
      const newSearch = searchParams.toString();
      const queryString = newSearch ? `?${newSearch}` : '';
      navigate({ to: `${location.pathname}${queryString}` as string, replace: true });
    },
    [location.pathname, location.search, navigate],
  );

  const TAB_DEFS = useMemo(
    () => [
      { value: 'overview', label: 'Overview', icon: HomeIcon },
      {
        value: 'all-studies',
        label: 'All Studies',
        icon: BookOpenIcon,
        getCount: getAllStudiesCount,
      },
      { value: 'todo', label: 'To Do', icon: ListTodoIcon, getCount: getToDoCount },
      {
        value: 'reconcile',
        label: 'Reconcile',
        icon: ArrowRightLeftIcon,
        getCount: getReconcileCount,
      },
      {
        value: 'completed',
        label: 'Completed',
        icon: CheckCircleIcon,
        getCount: getCompletedCount,
      },
    ],
    [getAllStudiesCount, getToDoCount, getReconcileCount, getCompletedCount],
  );

  return (
    <>
      {/* Child routes */}
      {isChildRoute && <Outlet />}

      {/* Main project view */}
      {!isChildRoute && (
        <div className='bg-background min-h-screen'>
          <Tabs value={tabFromUrl} onValueChange={handleTabChange}>
            {/* Sticky header */}
            <header className='border-border bg-card sticky top-0 z-20 border-b'>
              <div className='mx-auto max-w-7xl px-6'>
                <ProjectHeader
                  name={meta?.name as string}
                  description={meta?.description as string}
                  onRename={newName => project.project.rename(newName)}
                  onUpdateDescription={desc => project.project.updateDescription(desc)}
                  onBack={() => navigate({ to: '/dashboard' })}
                />
              </div>

              <div className='mx-auto max-w-7xl px-6'>
                <TabsList className='relative flex gap-1 overflow-x-auto bg-transparent pb-px'>
                  {TAB_DEFS.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className='text-muted-foreground hover:bg-muted hover:text-secondary-foreground group relative gap-2 rounded-t-lg px-4 py-2.5 transition-all data-[state=active]:bg-blue-50/50 data-[state=active]:text-blue-600'
                      >
                        <Icon className='size-4 opacity-60 transition-opacity group-data-[state=active]:opacity-100' />
                        <span className='font-medium'>{tab.label}</span>
                        {tab.getCount && (
                          <span className='bg-secondary text-secondary-foreground min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums transition-colors group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700'>
                            {tab.getCount()}
                          </span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                  <TabsIndicator className='bg-primary h-0.5 rounded-full' />
                </TabsList>
              </div>
            </header>

            {/* Main content */}
            <main className='mx-auto max-w-7xl px-6 py-6'>
              <TabsContent value='overview' className='mt-0'>
                <SectionErrorBoundary name='Overview'>
                  <OverviewTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='all-studies' className='mt-0'>
                <SectionErrorBoundary name='All Studies'>
                  <AllStudiesTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='todo' className='mt-0'>
                <SectionErrorBoundary name='To-Do'>
                  <ToDoTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='reconcile' className='mt-0'>
                <SectionErrorBoundary name='Reconcile'>
                  <ReconcileTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='completed' className='mt-0'>
                <SectionErrorBoundary name='Completed'>
                  <CompletedTab />
                </SectionErrorBoundary>
              </TabsContent>
            </main>
          </Tabs>
        </div>
      )}

      {!isChildRoute && <PdfPreviewPanel />}
    </>
  );
}
