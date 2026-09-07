/**
 * ProjectView - Main view for a single project
 * Establishes Yjs connection, processes pending data, renders tabbed interface.
 * Child routes (checklist, reconciliation) are rendered via Outlet.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from '@tanstack/react-router';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import { useAllStudies, useProjectMeta } from '@/project/workspace-data';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { ProjectGate } from '@/project';
import { project } from '@/project';
import { uploadPdf, deletePdf } from '@/api/pdf-api';
import { cachePdf } from '@/primitives/pdfCache.js';
import { bestEffort } from '@/lib/errorLogger.js';
import { importFromDrive } from '@/server/functions/google-drive.functions';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { getChecklistCount } from '@corates/shared/checklists';

import { ProjectHeader, type ProjectTabDef } from './ProjectHeader';
import { ProjectSheets } from './ProjectSheets';
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

const TAB_PANEL = 'w-full max-w-7xl px-6 py-6';

export function ProjectView({ projectId }: ProjectViewProps) {
  return (
    <ProjectGate projectId={projectId} fallback={<ProjectLoadingFallback />}>
      <ProjectViewInner projectId={projectId} />
    </ProjectGate>
  );
}

function ProjectLoadingFallback() {
  return (
    <div className='bg-background min-h-full'>
      {/* Header skeleton mirrors the real sticky project header */}
      <header className='border-border bg-card sticky top-0 z-20 border-b'>
        <div className='flex h-11 items-center gap-3 px-6'>
          <Skeleton className='h-5 w-48' />
          <div className='bg-border h-5 w-px' />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className='h-6 w-20 rounded-md' />
          ))}
          <Skeleton className='ml-auto h-7 w-28 rounded-md' />
        </div>
      </header>

      {/* Content skeleton with a quiet sync indicator */}
      <div className='mx-auto max-w-7xl px-6 py-6'>
        <div
          className='text-muted-foreground mb-6 flex items-center gap-2.5 text-sm'
          role='status'
          aria-live='polite'
        >
          <Spinner size='sm' variant='default' />
          <span>Loading your project...</span>
        </div>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className='border-border bg-card space-y-3 rounded-lg border p-4'
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <Skeleton className='h-5 w-3/4' />
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-5/6' />
              <div className='flex gap-2 pt-1'>
                <Skeleton className='h-6 w-16 rounded-full' />
                <Skeleton className='h-6 w-20 rounded-full' />
              </div>
            </div>
          ))}
        </div>
      </div>
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

  const studies = useAllStudies(projectId);
  const meta = useProjectMeta(projectId);
  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));

  const [pendingPdfs, setPendingPdfs] = useState<any[] | null>(null);
  const [pendingRefs, setPendingRefs] = useState<any[] | null>(null);
  const [pendingDriveFiles, setPendingDriveFiles] = useState<any[] | null>(null);

  useEffect(() => {
    if (
      connectionState.phase !== 'synced' ||
      !projectId ||
      !orgId ||
      !Array.isArray(pendingPdfs) ||
      pendingPdfs.length === 0
    )
      return;
    const pdfs = pendingPdfs;
    setPendingPdfs(null);

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
                capture: true,
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
  }, [connectionState.phase, projectId, orgId, pendingPdfs, user?.id]);

  useEffect(() => {
    if (
      connectionState.phase !== 'synced' ||
      !projectId ||
      !Array.isArray(pendingRefs) ||
      pendingRefs.length === 0
    )
      return;
    const refs = pendingRefs;
    setPendingRefs(null);
    for (const ref of refs) {
      project.study.create(ref.title, ref.metadata?.abstract || '', ref.metadata || {});
    }
  }, [connectionState.phase, projectId, pendingRefs]);

  useEffect(() => {
    if (
      connectionState.phase !== 'synced' ||
      !projectId ||
      !orgId ||
      !Array.isArray(pendingDriveFiles) ||
      pendingDriveFiles.length === 0
    )
      return;
    const driveFiles = pendingDriveFiles;
    setPendingDriveFiles(null);
    for (const file of driveFiles) {
      const title = file.title || file.name.replace(/\.pdf$/i, '');
      const metadata = {
        ...(file.metadata || {}),
        importSource: file.metadata?.importSource || file.importSource || 'google-drive',
      };
      const studyId = project.study.create(title, file.metadata?.abstract || '', metadata);
      if (studyId && file.id) {
        importFromDrive({ data: { fileId: file.id, projectId, studyId } })
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
                capture: true,
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
  }, [connectionState.phase, projectId, orgId, pendingDriveFiles, user?.id]);

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

  const TAB_DEFS = useMemo<ProjectTabDef[]>(
    () => [
      { value: 'overview', label: 'Overview' },
      { value: 'all-studies', label: 'All studies', count: getAllStudiesCount() },
      { value: 'todo', label: 'To-Do', count: getToDoCount() },
      { value: 'reconcile', label: 'Reconcile', count: getReconcileCount() },
      { value: 'completed', label: 'Completed', count: getCompletedCount() },
    ],
    [getAllStudiesCount, getToDoCount, getReconcileCount, getCompletedCount],
  );

  return (
    <>
      {/* Child routes render no project header, so the sync-pending marker the
          e2e suite waits on (see shared-steps waitForSynced) lives here. */}
      {isChildRoute && (
        <>
          <div data-sync-pending={connectionState.pending} hidden />
          <Outlet />
        </>
      )}

      {/* Main project view */}
      {!isChildRoute && (
        <div className='bg-background flex min-h-full flex-col'>
          <Tabs value={tabFromUrl} onValueChange={handleTabChange} className='flex flex-1 flex-col'>
            {/* Sticky header */}
            <header className='border-border bg-card sticky top-0 z-20 border-b px-6'>
              <ProjectHeader
                name={meta.name ?? undefined}
                onRename={newName => project.project.rename(newName)}
                tabs={TAB_DEFS}
              />
            </header>

            {/* Overview lays out its own columns so its divider spans the full height */}
            <TabsContent value='overview' className='flex-1'>
              <SectionErrorBoundary name='Overview'>
                <OverviewTab />
              </SectionErrorBoundary>
            </TabsContent>
            <TabsContent value='all-studies' className={TAB_PANEL}>
              <SectionErrorBoundary name='All studies'>
                <AllStudiesTab />
              </SectionErrorBoundary>
            </TabsContent>
            <TabsContent value='todo' className={TAB_PANEL}>
              <SectionErrorBoundary name='To-Do'>
                <ToDoTab />
              </SectionErrorBoundary>
            </TabsContent>
            <TabsContent value='reconcile' className={TAB_PANEL}>
              <SectionErrorBoundary name='Reconcile'>
                <ReconcileTab />
              </SectionErrorBoundary>
            </TabsContent>
            <TabsContent value='completed' className={TAB_PANEL}>
              <SectionErrorBoundary name='Completed'>
                <CompletedTab />
              </SectionErrorBoundary>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!isChildRoute && <ProjectSheets />}
      {!isChildRoute && <PdfPreviewPanel />}
    </>
  );
}
