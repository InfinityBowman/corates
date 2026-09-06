/**
 * ProjectHeader - Inline-editable project name
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import { useProjectContext } from './ProjectContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineEdit } from '@/components/ui/inline-edit';
import { ProjectHeaderActions } from './ProjectHeaderActions';
import { SyncStatusIndicator } from './SyncStatusIndicator';

interface ProjectHeaderProps {
  name?: string;
  onRename?: (name: string) => Promise<void> | void;
  onBack?: () => void;
}

export function ProjectHeader({ name, onRename, onBack }: ProjectHeaderProps) {
  const { userRole } = useProjectContext();

  const canEdit = useMemo(() => userRole === 'owner' || userRole === 'collaborator', [userRole]);

  const [localName, setLocalName] = useState(name || '');

  // Sync local state when external data loads
  useEffect(() => {
    if (name) setLocalName(name);
  }, [name]);

  const handleNameCommit = useCallback(
    async (value: string) => {
      const newName = value.trim();
      if (newName && newName !== name) {
        setLocalName(newName);
        try {
          await onRename?.(newName);
        } catch (error) {
          const { handleError } = await import('@/lib/error-utils');
          await handleError(error, { toastTitle: 'Failed to rename project' });
          setLocalName(name || '');
        }
      } else {
        setLocalName(name || '');
      }
    },
    [name, onRename],
  );

  return (
    <div className='flex items-center justify-between py-4'>
      <div className='flex items-center gap-4'>
        <Button
          variant='outline'
          size='icon-lg'
          onClick={onBack}
          className='text-muted-foreground'
          aria-label='Back to dashboard'
        >
          <ArrowLeftIcon className='size-4' />
        </Button>
        <div className='min-w-0'>
          {/* Project Name */}
          <div className='flex items-center gap-2'>
            <InlineEdit
              value={localName}
              onCommit={handleNameCommit}
              disabled={!canEdit}
              showEditIcon={canEdit}
              placeholder='Project name...'
              ariaLabel='Edit project name'
              className='text-foreground text-lg font-semibold'
            />
            {userRole && (
              <Badge variant='info' className='capitalize'>
                {userRole}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className='flex items-center gap-3'>
        <SyncStatusIndicator />
        <ProjectHeaderActions />
      </div>
    </div>
  );
}
