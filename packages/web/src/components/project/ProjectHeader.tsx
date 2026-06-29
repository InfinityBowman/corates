/**
 * ProjectHeader - Inline-editable project name and description
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import { useProjectContext } from './ProjectContext';
import { InlineEdit } from '@/components/ui/inline-edit';

interface ProjectHeaderProps {
  name?: string;
  description?: string;
  onRename?: (name: string) => Promise<void> | void;
  onUpdateDescription?: (desc: string) => Promise<void> | void;
  onBack?: () => void;
}

export function ProjectHeader({
  name,
  description,
  onRename,
  onUpdateDescription,
  onBack,
}: ProjectHeaderProps) {
  const { userRole } = useProjectContext();

  const canEdit = useMemo(() => userRole === 'owner' || userRole === 'collaborator', [userRole]);

  const [localName, setLocalName] = useState(name || '');
  const [localDescription, setLocalDescription] = useState(description || '');

  // Sync local state when external data loads
  useEffect(() => {
    if (name) setLocalName(name);
  }, [name]);

  useEffect(() => {
    setLocalDescription(description || '');
  }, [description]);

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

  const handleDescriptionCommit = useCallback(
    async (value: string) => {
      const newDesc = value.trim();
      const currentDesc = description || '';
      if (newDesc !== currentDesc) {
        setLocalDescription(newDesc);
        try {
          await onUpdateDescription?.(newDesc);
        } catch (error) {
          const { handleError } = await import('@/lib/error-utils');
          await handleError(error, { toastTitle: 'Failed to update description' });
          setLocalDescription(description || '');
        }
      }
    },
    [description, onUpdateDescription],
  );

  return (
    <div className='flex items-center justify-between py-4'>
      <div className='flex items-center gap-4'>
        <button
          onClick={onBack}
          className='border-border text-muted-foreground hover:text-secondary-foreground flex size-9 items-center justify-center rounded-lg border transition-colors'
        >
          <ArrowLeftIcon className='size-4' />
        </button>
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
              <span className='border-info-border bg-info-bg text-info inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize'>
                {userRole}
              </span>
            )}
          </div>

          {/* Project Description */}
          <div className='mt-0.5 w-full max-w-2xl'>
            <InlineEdit
              value={localDescription}
              onCommit={handleDescriptionCommit}
              disabled={!canEdit}
              showEditIcon={canEdit}
              multiline
              placeholder='Add a project description...'
              ariaLabel='Edit project description'
              className='text-muted-foreground text-sm'
            />
          </div>
        </div>
      </div>
    </div>
  );
}
