/**
 * ProjectHeader - one sticky row: project name, role, tabs, then the actions.
 * Must render inside the project's <Tabs> so the tab list can bind to it.
 */

import { useState, useEffect } from 'react';
import { useProjectContext } from './ProjectContext';
import { Badge } from '@/components/ui/badge';
import { InlineEdit } from '@/components/ui/inline-edit';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectHeaderActions } from './ProjectHeaderActions';
import { SyncStatusIndicator } from './SyncStatusIndicator';

export interface ProjectTabDef {
  value: string;
  label: string;
  count?: number;
}

interface ProjectHeaderProps {
  name?: string;
  onRename?: (name: string) => Promise<void> | void;
  tabs: ProjectTabDef[];
}

export function ProjectHeader({ name, onRename, tabs }: ProjectHeaderProps) {
  const { userRole } = useProjectContext();
  const canEdit = userRole === 'owner' || userRole === 'collaborator';

  const [localName, setLocalName] = useState(name || '');

  // Sync local state when external data loads
  useEffect(() => {
    if (name) setLocalName(name);
  }, [name]);

  async function handleNameCommit(value: string) {
    const newName = value.trim();
    if (!newName || newName === name) {
      setLocalName(name || '');
      return;
    }
    setLocalName(newName);
    try {
      await onRename?.(newName);
    } catch (error) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(error, { toastTitle: 'Failed to rename project' });
      setLocalName(name || '');
    }
  }

  return (
    <div className='flex h-11 items-center gap-3'>
      <div className='flex min-w-0 shrink items-center gap-2'>
        <InlineEdit
          value={localName}
          onCommit={handleNameCommit}
          disabled={!canEdit}
          showEditIcon={canEdit}
          placeholder='Project name...'
          ariaLabel='Edit project name'
          className='text-foreground truncate text-sm font-semibold'
        />
        {userRole && (
          <Badge variant='outline' className='shrink-0 capitalize'>
            {userRole}
          </Badge>
        )}
      </div>

      <div className='bg-border h-5 w-px shrink-0' aria-hidden='true' />

      <TabsList className='flex min-w-0 flex-1 gap-0.5 overflow-x-auto'>
        {tabs.map(tab => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className='text-muted-foreground hover:bg-muted hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground h-7 gap-1.5 rounded-md px-2.5 py-0'
          >
            {tab.label}
            {tab.count != null && (
              <span className='text-muted-foreground/80 text-xs tabular-nums'>{tab.count}</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      <SyncStatusIndicator />
      <ProjectHeaderActions />
    </div>
  );
}
