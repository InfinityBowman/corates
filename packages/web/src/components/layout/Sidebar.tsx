/**
 * Sidebar - Desktop (expanded/collapsed rail) + Mobile (slide-in overlay)
 *
 * Desktop: always in DOM, toggles between expanded (resizable) and collapsed rail (w-12).
 * Mobile: portal overlay that slides in when mobileOpen is true.
 * Content is shared via SidebarContent to avoid duplication.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { createPortal } from 'react-dom';
import {
  HomeIcon,
  CloudIcon,
  FileCheck2Icon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  XIcon,
  FolderIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useAuthStore, selectUser, selectIsLoggedIn } from '@/stores/authStore';
import { useLocalChecklistsStore } from '@/stores/localChecklistsStore';
import { useMyProjectsList } from '@/hooks/useMyProjectsList';
import { showToast } from '@/components/ui/toast';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ProjectTreeItem } from './sidebar/ProjectTreeItem';
import { LocalChecklistItem } from './sidebar/LocalChecklistItem';

interface SidebarProps {
  desktopMode: 'expanded' | 'collapsed';
  mobileOpen: boolean;
  onToggleDesktop: () => void;
  onCloseMobile: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export function Sidebar({
  desktopMode,
  mobileOpen,
  onToggleDesktop,
  onCloseMobile,
  width,
  onWidthChange,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore(selectUser);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const checklists = useLocalChecklistsStore(s => s.checklists);
  const deleteChecklist = useLocalChecklistsStore(s => s.deleteChecklist);

  const currentUserId = user?.id;

  // Expand/collapse state for project and study tree items
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedStudies, setExpandedStudies] = useState<Record<string, boolean>>({});
  const [isResizing, setIsResizing] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { projects: cloudProjects, isLoading: isProjectsLoading } = useMyProjectsList({
    enabled: isLoggedIn,
  });

  const isExpanded = desktopMode === 'expanded';
  const currentPath = location.pathname;

  const toggleProject = useCallback((projectId: string) => {
    setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  }, []);

  const toggleStudy = useCallback((studyId: string) => {
    setExpandedStudies(prev => ({ ...prev, [studyId]: !prev[studyId] }));
  }, []);

  const isStudyExpanded = useCallback(
    (studyId: string) => expandedStudies[studyId] || false,
    [expandedStudies],
  );

  const isCurrentPath = useCallback((path: string) => currentPath === path, [currentPath]);

  // Resize drag handler
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        onWidthChange(startWidth + (moveEvent.clientX - startX));
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width, onWidthChange],
  );

  // Delete local checklist
  const handleDeleteLocalChecklist = useCallback((e: React.MouseEvent, checklistId: string) => {
    e.stopPropagation();
    setPendingDeleteId(checklistId);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteChecklist = useCallback(async () => {
    if (!pendingDeleteId) {
      setDeleteDialogOpen(false);
      return;
    }
    try {
      await deleteChecklist(pendingDeleteId);
    } catch (err) {
      console.error('Failed to delete checklist:', err);
      showToast.error('Delete Failed', 'Could not delete the checklist. Please try again.');
    } finally {
      setDeleteDialogOpen(false);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, deleteChecklist]);

  // Close mobile on escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  // Close mobile on route change
  useEffect(() => {
    if (mobileOpen) onCloseMobile();
  }, [currentPath, mobileOpen, onCloseMobile]);

  // --- Shared sidebar content (lowercase to avoid lint "component during render" error) ---
  function renderSidebarContent() {
    return (
      <div className='sidebar-scrollbar flex-1 overflow-x-hidden overflow-y-auto'>
        {/* Projects home link */}
        <div className='p-2'>
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isCurrentPath('/') || isCurrentPath('/dashboard') ?
                'bg-primary/10 text-primary'
              : 'text-secondary-foreground hover:bg-secondary'
            }`}
          >
            <HomeIcon className='size-4 shrink-0' />
            <span className='truncate'>Projects</span>
          </button>
        </div>

        {/* Cloud Projects */}
        {isLoggedIn && (
          <>
            <div className='px-3 pt-4 pb-2'>
              <h3 className='text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase'>
                <CloudIcon className='size-3' />
                Projects
              </h3>
            </div>
            <div className='flex flex-col gap-0.5 px-2'>
              {cloudProjects?.length > 0 ?
                cloudProjects.map((project: { id: string; name: string }) => (
                  <ProjectTreeItem
                    key={project.id}
                    project={project}
                    isExpanded={expandedProjects[project.id] || false}
                    onToggle={() => toggleProject(project.id)}
                    userId={currentUserId}
                    currentPath={currentPath}
                    isStudyExpanded={isStudyExpanded}
                    onToggleStudy={toggleStudy}
                  />
                ))
              : !isProjectsLoading ?
                <div className='px-2 py-4 text-center'>
                  <div className='bg-secondary mx-auto mb-2 flex size-8 items-center justify-center rounded-lg'>
                    <FolderIcon className='text-muted-foreground/70 size-4' />
                  </div>
                  <p className='text-muted-foreground text-xs font-medium'>No projects yet</p>
                  <button
                    onClick={() => navigate({ to: '/dashboard' })}
                    className='text-primary hover:text-primary/80 mt-1 text-xs'
                  >
                    Create a project
                  </button>
                </div>
              : null}
            </div>
          </>
        )}

        {/* Local Checklists */}
        <div className='px-3 pt-6 pb-2'>
          <h3 className='text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase'>
            <FileCheck2Icon className='size-3' />
            Appraisals
          </h3>
        </div>
        <div className='flex flex-col gap-0.5 px-2'>
          {checklists?.length > 0 ?
            checklists
              .filter((c: { id?: string }) => c?.id)
              .map(
                (checklist: {
                  id: string;
                  name?: string;
                  updatedAt?: number;
                  createdAt?: number;
                }) => (
                  <LocalChecklistItem
                    key={checklist.id}
                    checklist={checklist}
                    isSelected={currentPath === `/checklist/${checklist.id}`}
                    onDelete={handleDeleteLocalChecklist}
                  />
                ),
              )
          : <div className='px-2 py-4 text-center'>
              <div className='bg-secondary mx-auto mb-2 flex size-8 items-center justify-center rounded-lg'>
                <FileCheck2Icon className='text-muted-foreground/70 size-4' />
              </div>
              <p className='text-muted-foreground text-xs font-medium'>No appraisals</p>
              <button
                onClick={() => navigate({ to: '/checklist' as string })}
                className='text-primary hover:text-primary/80 mt-1 text-xs'
              >
                Create one
              </button>
            </div>
          }
        </div>

        <div className='h-8' />
      </div>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={`sidebar-container border-border bg-card relative hidden h-full shrink-0 border-r md:block ${
          isResizing ? '' : 'transition-all duration-200 ease-in-out'
        } ${isExpanded ? '' : 'md:w-12'}`}
        style={{
          maxWidth: '100vw',
          width: isExpanded ? `${width}px` : undefined,
        }}
      >
        <div className='flex h-full flex-col'>
          {/* Header -- both states always rendered, cross-fade */}
          <div className='border-border relative shrink-0 border-b'>
            {/* Collapsed header (bottom layer) */}
            <div
              className={`flex items-center justify-center p-2 transition-opacity duration-200 ${
                isExpanded ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
              aria-hidden={isExpanded}
            >
              <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleDesktop}
                    className='text-muted-foreground hover:bg-secondary hover:text-secondary-foreground hidden size-8 items-center justify-center rounded-md transition-colors md:flex'
                    aria-label='Expand sidebar'
                  >
                    <ChevronsRightIcon className='size-4' />
                  </button>
                </TooltipTrigger>
                <TooltipContent side='right'>Expand sidebar</TooltipContent>
              </Tooltip>
            </div>

            {/* Expanded header (top layer) */}
            <div
              className={`absolute inset-0 flex items-center p-2 transition-opacity duration-200 ${
                isExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              aria-hidden={!isExpanded}
            >
              <span className='text-secondary-foreground flex-1 truncate px-2 text-sm font-semibold'>
                CoRATES
              </span>
              <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleDesktop}
                    className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground hidden size-8 items-center justify-center rounded-md transition-colors md:flex'
                    aria-label='Collapse sidebar'
                  >
                    <ChevronsLeftIcon className='size-4' />
                  </button>
                </TooltipTrigger>
                <TooltipContent side='right'>Collapse sidebar</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Content area -- both layers always rendered, cross-fade with opacity */}
          <div className='relative flex-1 overflow-hidden'>
            {/* Collapsed rail icons (bottom layer) -- always rendered, fixed w-12 */}
            <div
              className={`absolute inset-y-0 left-0 hidden w-12 flex-col items-center gap-1 overflow-y-auto py-2 transition-opacity duration-200 md:flex ${
                isExpanded ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
              aria-hidden={isExpanded}
              inert={isExpanded ? true : undefined}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate({ to: '/dashboard' })}
                    className={`flex size-8 items-center justify-center rounded-md transition-colors ${
                      isCurrentPath('/dashboard') || isCurrentPath('/') ?
                        'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
                    }`}
                    aria-label='Projects'
                  >
                    <HomeIcon className='size-4' />
                  </button>
                </TooltipTrigger>
                <TooltipContent side='right'>Projects</TooltipContent>
              </Tooltip>

              {isLoggedIn && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onToggleDesktop}
                      className='text-muted-foreground hover:bg-secondary hover:text-secondary-foreground flex size-8 items-center justify-center rounded-md transition-colors'
                      aria-label='Projects'
                    >
                      <CloudIcon className='size-4' />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side='right'>Projects</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleDesktop}
                    className='text-muted-foreground hover:bg-secondary hover:text-secondary-foreground flex size-8 items-center justify-center rounded-md transition-colors'
                    aria-label='Appraisals'
                  >
                    <FileCheck2Icon className='size-4' />
                  </button>
                </TooltipTrigger>
                <TooltipContent side='right'>Appraisals</TooltipContent>
              </Tooltip>
            </div>

            {/* Expanded content (top layer) -- overlays rail icons */}
            <div
              className={`absolute inset-0 transition-opacity duration-200 ${
                isExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              aria-hidden={!isExpanded}
              inert={!isExpanded ? true : undefined}
            >
              {renderSidebarContent()}
            </div>
          </div>
        </div>

        {/* Resize handle */}
        {isExpanded && (
          <div
            className='hover:bg-primary absolute top-0 right-0 hidden h-full w-1 cursor-col-resize bg-transparent transition-colors md:block'
            onMouseDown={handleResizeStart}
            role='separator'
            aria-orientation='vertical'
            aria-label='Resize sidebar'
          />
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='danger'>
              <TriangleAlertIcon />
            </AlertDialogIcon>
            <div>
              <AlertDialogTitle>Delete Checklist</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this checklist? This cannot be undone.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmDeleteChecklist}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile overlay -- always mounted, CSS-only transitions */}
      {createPortal(
        <div className='md:hidden' aria-hidden={!mobileOpen} inert={!mobileOpen ? true : undefined}>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
              mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={onCloseMobile}
          />
          {/* Panel */}
          <div
            className={`bg-card fixed inset-y-0 left-0 z-50 w-64 pt-9 shadow-xl transition-transform duration-200 ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
          >
            <div className='flex h-full flex-col'>
              <div className='border-border bg-card flex shrink-0 items-center border-b p-2'>
                <span className='text-secondary-foreground flex-1 truncate px-2 text-sm font-semibold'>
                  CoRATES
                </span>
                <button
                  onClick={onCloseMobile}
                  className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground flex size-7 items-center justify-center rounded-md transition-colors'
                  aria-label='Close sidebar'
                >
                  <XIcon className='size-4' />
                </button>
              </div>
              {renderSidebarContent()}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
