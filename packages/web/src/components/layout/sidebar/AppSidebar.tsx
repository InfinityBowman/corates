/**
 * AppSidebar - account menu, Home and Inbox, then flat lists of projects and
 * local appraisals. Rendered once for desktop and once for the mobile overlay.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from '@tanstack/react-router';
import { HomeIcon, PlusIcon, WifiOffIcon, TriangleAlertIcon } from 'lucide-react';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';
import { useAllStudies } from '@/project/workspace-data';
import { applyLocalMutation } from '@/project/localWrites';
import { LOCAL_PROJECT_ID } from '@/project/localProject';
import { db } from '@/primitives/db';
import { useMyProjectsList } from '@/hooks/useMyProjectsList';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
import { NAV_GROUP_LABEL, navRowClass } from '../navStyles';
import { AccountMenu } from './AccountMenu';
import { InboxRow } from './InboxRow';
import { ProjectRow } from './ProjectRow';
import { LocalChecklistItem } from './LocalChecklistItem';

interface AppSidebarProps {
  onClose: () => void;
  closeLabel: string;
  closeIcon: React.ReactNode;
}

function GroupHeader({
  label,
  addLabel,
  onAdd,
}: {
  label: string;
  addLabel: string;
  onAdd?: () => void;
}) {
  return (
    <div className={NAV_GROUP_LABEL}>
      <span>{label}</span>
      {onAdd && (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon-xs'
              onClick={onAdd}
              className='text-muted-foreground/70 hover:text-foreground -mr-1'
              aria-label={addLabel}
            >
              <PlusIcon className='size-3.5' />
            </Button>
          </TooltipTrigger>
          <TooltipContent side='right'>{addLabel}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function AppSidebar({ onClose, closeLabel, closeIcon }: AppSidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const isOnline = useOnlineStatus();
  const { projects, isLoading: isProjectsLoading } = useMyProjectsList({ enabled: isLoggedIn });

  const localStudies = useAllStudies(LOCAL_PROJECT_ID);
  const checklists = localStudies
    .flatMap(study => {
      const checklist = study.checklists?.[0];
      if (!checklist) return [];
      return [
        {
          id: study.id,
          name: study.name,
          updatedAt: (checklist.updatedAt ?? study.updatedAt) as number | undefined,
        },
      ];
    })
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isHome = pathname === '/' || pathname === '/dashboard';

  async function confirmDeleteChecklist() {
    if (!pendingDeleteId) return;
    try {
      // Cascades the checklist + answers rows.
      applyLocalMutation(LOCAL_PROJECT_ID, 'study.delete', { id: pendingDeleteId });
      await db.localChecklistPdfs.delete(pendingDeleteId);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Delete Failed' });
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <nav aria-label='Main' className='flex h-full flex-col'>
      <div className='flex shrink-0 items-center gap-1 px-2 pt-2 pb-1'>
        <AccountMenu />
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={onClose}
              className='text-muted-foreground/70 hover:text-muted-foreground shrink-0'
              aria-label={closeLabel}
            >
              {closeIcon}
            </Button>
          </TooltipTrigger>
          <TooltipContent side='right'>{closeLabel}</TooltipContent>
        </Tooltip>
      </div>

      <div className='flex-1 overflow-x-hidden overflow-y-auto px-2 pb-4'>
        <div className='mb-4 flex flex-col gap-0.5'>
          <Link to='/dashboard' className={navRowClass(isHome)}>
            <HomeIcon className='size-4 shrink-0' />
            <span className='truncate'>Home</span>
          </Link>
          {isLoggedIn && <InboxRow />}
        </div>

        {isLoggedIn && (
          <div className='mb-4'>
            <GroupHeader
              label='Projects'
              addLabel='New project'
              onAdd={() => setCreateModalOpen(true)}
            />
            <div className='flex flex-col gap-0.5'>
              {projects.length > 0 ?
                projects.map(project => (
                  <ProjectRow key={project.id} project={project} currentPath={pathname} />
                ))
              : !isProjectsLoading ?
                <span className='text-muted-foreground/70 px-2.5 py-1.5 text-sm'>None yet</span>
              : null}
            </div>
          </div>
        )}

        <div className='mb-4'>
          <GroupHeader
            label='Local appraisals'
            addLabel='New appraisal'
            onAdd={() => navigate({ to: '/checklist' as string })}
          />
          <div className='flex flex-col gap-0.5'>
            {checklists.length > 0 ?
              checklists.map(checklist => (
                <LocalChecklistItem
                  key={checklist.id}
                  checklist={checklist}
                  isSelected={pathname === `/checklist/${checklist.id}`}
                  onDelete={(e, id) => {
                    e.stopPropagation();
                    setPendingDeleteId(id);
                  }}
                />
              ))
            : <span className='text-muted-foreground/70 px-2.5 py-1.5 text-sm'>None yet</span>}
          </div>
        </div>
      </div>

      {(!isOnline || !isLoggedIn) && (
        <div className='border-border flex shrink-0 items-center gap-2 border-t px-3 py-2.5'>
          {!isOnline && (
            <Badge variant='warning'>
              <WifiOffIcon />
              Offline
            </Badge>
          )}
          {!isLoggedIn && (
            <div className='ml-auto flex items-center gap-1'>
              <Button variant='ghost' size='sm' asChild>
                <Link to='/signin'>Sign in</Link>
              </Button>
              <Button size='sm' asChild>
                <Link to='/signup'>Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      <CreateProjectModal open={createModalOpen} onOpenChange={setCreateModalOpen} />

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={open => {
          if (!open) setPendingDeleteId(null);
        }}
      >
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
    </nav>
  );
}
