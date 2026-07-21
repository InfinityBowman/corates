/**
 * ProjectView - Main view for a single project
 * Establishes Yjs connection, renders tabbed interface.
 * Child routes (checklist, reconciliation) are rendered via Outlet.
 */

import { useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from '@tanstack/react-router';
import { useAllStudiesById, useProjectMetaById } from '@/primitives/useProject/reactor';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { ProjectGate, project } from '@/project';
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  HomeIcon,
  BookOpenIcon,
  ListTodoIcon,
  ArrowRightLeftIcon,
  CheckCircleIcon,
} from 'lucide-react';
import { getChecklistCount } from '@corates/shared/checklists';

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
    <div className='bg-background min-h-full'>
      {/* Header skeleton mirrors the real sticky project header */}
      <header className='border-border bg-card sticky top-0 z-20 border-b'>
        <div className='mx-auto max-w-7xl px-6 py-4'>
          <div className='flex items-center gap-3'>
            <Skeleton className='size-8 shrink-0 rounded-md' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-6 w-56 max-w-full' />
              <Skeleton className='h-4 w-80 max-w-full' />
            </div>
          </div>
        </div>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='flex gap-1 pb-px'>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className='h-9 w-28 rounded-t-lg' />
            ))}
          </div>
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
          <span>Syncing project...</span>
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

  const isChildRoute = useMemo(() => {
    const path = location.pathname;
    return path.includes('/checklists/') || path.includes('/reconcile/');
  }, [location.pathname]);

  const studies = useAllStudiesById(projectId);
  const meta = useProjectMetaById(projectId);

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
        <div className='bg-background min-h-full'>
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
                          <Badge
                            variant='secondary'
                            className='min-w-6 px-1.5 tabular-nums group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700'
                          >
                            {tab.getCount()}
                          </Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                  <TabsIndicator className='bg-primary h-0.5 rounded-full' />
                </TabsList>
              </div>
            </header>

            {/* Main content */}
            <div className='mx-auto max-w-7xl px-6 py-6'>
              <TabsContent value='overview'>
                <SectionErrorBoundary name='Overview'>
                  <OverviewTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='all-studies'>
                <SectionErrorBoundary name='All Studies'>
                  <AllStudiesTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='todo'>
                <SectionErrorBoundary name='To-Do'>
                  <ToDoTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='reconcile'>
                <SectionErrorBoundary name='Reconcile'>
                  <ReconcileTab />
                </SectionErrorBoundary>
              </TabsContent>
              <TabsContent value='completed'>
                <SectionErrorBoundary name='Completed'>
                  <CompletedTab />
                </SectionErrorBoundary>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}

      {!isChildRoute && <PdfPreviewPanel />}
    </>
  );
}
