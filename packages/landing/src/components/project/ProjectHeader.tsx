/**
 * ProjectHeader - Inline-editable project name and description
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeftIcon, PencilIcon } from 'lucide-react';
import { useProjectContext } from './ProjectContext';
import {
  Editable,
  EditableArea,
  EditableInput,
  EditableTextarea,
  EditablePreview,
  EditableEditTrigger,
  EditableContext,
} from '@/components/ui/editable';

/* eslint-disable no-unused-vars */
interface ProjectHeaderProps {
  name?: string;
  description?: string;
  onRename?: (name: string) => Promise<void> | void;
  onUpdateDescription?: (desc: string) => Promise<void> | void;
  onBack?: () => void;
}
/* eslint-enable no-unused-vars */

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
    async (details: { value: string }) => {
      const newName = details.value.trim();
      if (newName && newName !== name) {
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
    async (details: { value: string }) => {
      const newDesc = details.value.trim();
      const currentDesc = description || '';
      if (newDesc !== currentDesc) {
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
          className='border-border text-muted-foreground hover:text-secondary-foreground flex h-9 w-9 items-center justify-center rounded-lg border transition-colors'
        >
          <ArrowLeftIcon className='h-4 w-4' />
        </button>
        <div className='min-w-0'>
          {/* Project Name */}
          <div className='flex items-center gap-2'>
            <Editable
              value={localName}
              onValueChange={(details: any) => setLocalName(details.value)}
              onValueCommit={handleNameCommit}
              activationMode='click'
              submitMode='both'
              disabled={!canEdit}
              placeholder='Project name...'
              className='group'
            >
              <div className='flex items-center gap-1'>
                <EditableArea className='hover:bg-muted rounded px-1 transition-colors'>
                  <EditableInput className='text-foreground bg-transparent text-lg font-semibold outline-none' />
                  <EditablePreview className='text-foreground cursor-text text-lg font-semibold' />
                </EditableArea>
                {canEdit && (
                  <EditableContext>
                    {(api: any) =>
                      !api.editing && (
                        <EditableEditTrigger className='text-muted-foreground/60 hover:text-muted-foreground rounded p-1 opacity-0 transition-colors group-hover:opacity-100'>
                          <PencilIcon className='h-3.5 w-3.5' />
                        </EditableEditTrigger>
                      )
                    }
                  </EditableContext>
                )}
              </div>
            </Editable>
            {userRole && (
              <span className='inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize'>
                {userRole}
              </span>
            )}
          </div>

          {/* Project Description */}
          <Editable
            value={localDescription}
            onValueChange={(details: any) => setLocalDescription(details.value)}
            onValueCommit={handleDescriptionCommit}
            activationMode='click'
            submitMode='both'
            autoResize
            disabled={!canEdit}
            placeholder='Add a project description...'
            className='group mt-0.5 w-full max-w-2xl'
          >
            <div className='flex items-center gap-1'>
              <EditableArea className='hover:bg-muted w-full rounded px-1 py-0.5 transition-colors'>
                <EditableTextarea
                  className='text-muted-foreground min-h-6 w-full text-sm'
                  rows={1}
                />
                <EditablePreview className='text-muted-foreground cursor-text text-sm' />
              </EditableArea>
              {canEdit && (
                <EditableContext>
                  {(api: any) =>
                    !api.editing && (
                      <EditableEditTrigger className='text-muted-foreground/60 hover:text-muted-foreground self-start rounded p-1 opacity-0 transition-colors group-hover:opacity-100'>
                        <PencilIcon className='h-3 w-3' />
                      </EditableEditTrigger>
                    )
                  }
                </EditableContext>
              )}
            </div>
          </Editable>
        </div>
      </div>
    </div>
  );
}
