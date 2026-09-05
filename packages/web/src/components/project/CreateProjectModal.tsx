/**
 * CreateProjectModal - Composer-style dialog for creating a new project.
 *
 * Collects project name and organization (if user has multiple), then lands
 * the owner in first-run setup.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CheckIcon, ChevronRightIcon, CommandIcon, CornerDownLeftIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getInitials } from '@/components/ui/avatar';
import { showToast } from '@/lib/toast';
import { useOrgs } from '@/hooks/useOrgs';
import { queryKeys } from '@/lib/queryKeys';
import { handleError, isErrorCode, getDomainError } from '@/lib/error-utils';
import { AUTH_ERRORS } from '@corates/shared';
import type { ChecklistType } from '@corates/shared/sync';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { createProject } from '@/server/functions/org-projects.functions';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const TOOLS: {
  type: ChecklistType;
  name: string;
  description: string;
  dotClass: string;
}[] = [
  {
    type: 'AMSTAR2',
    name: 'AMSTAR 2',
    description: 'Quality of systematic reviews',
    dotClass: 'bg-blue-500',
  },
  {
    type: 'ROB2',
    name: 'RoB 2',
    description: 'Risk of bias in randomized trials',
    dotClass: 'bg-violet-500',
  },
  {
    type: 'ROBINS_I',
    name: 'ROBINS-I',
    description: 'Risk of bias in non-randomized studies',
    dotClass: 'bg-emerald-500',
  },
];

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [projectName, setProjectName] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedTools, setSelectedTools] = useState<Set<ChecklistType>>(() => new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { orgs, isLoading: orgsLoading } = useOrgs();

  useEffect(() => {
    if (orgs.length > 1 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  const resolvedOrgId = orgs.length === 1 ? orgs[0].id : selectedOrgId;
  const resolvedOrg = orgs.find(org => org.id === resolvedOrgId);

  useEffect(() => {
    if (!open) {
      setProjectName('');
      setSelectedOrgId(null);
      setSelectedTools(new Set());
    }
  }, [open]);

  const canSubmit = projectName.trim().length > 0 && !isSubmitting && !!resolvedOrgId;

  const toggleTool = (type: ChecklistType) => {
    setSelectedTools(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!projectName.trim()) return;

    const orgId = resolvedOrgId;
    if (!orgId) {
      showToast.error('Choose a team', 'Select which team this project belongs to.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newProject = (await createProject({
        data: {
          orgId,
          name: projectName.trim(),
        },
      })) as { id: string };

      track('Project:Created');
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      onOpenChange(false);

      navigate({ to: '/projects/$projectId/setup', params: { projectId: newProject.id } });
    } catch (error: unknown) {
      const domainError = getDomainError(error);
      const details = domainError?.details as Record<string, unknown> | undefined;
      if (domainError && isErrorCode(domainError, AUTH_ERRORS.FORBIDDEN.code)) {
        if (details?.reason === 'missing_entitlement') {
          showToast.error(
            'Not included in your plan',
            `Creating this project needs the '${details.entitlement}' entitlement. Upgrade your plan to continue.`,
          );
        } else if (details?.reason === 'quota_exceeded') {
          const { quotaKey, used, limit, requested } = details as Record<string, number>;
          showToast.error(
            'Plan limit reached',
            `${quotaKey}: you are using ${used} of ${isUnlimitedQuota(limit) ? 'unlimited' : limit}, and this needs ${requested} more. Upgrade your plan to continue.`,
          );
        } else {
          await handleError(error, { toastTitle: 'Could not create the project' });
        }
      } else {
        await handleError(error, { toastTitle: 'Could not create the project' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-0 overflow-hidden p-0 sm:max-w-[620px]' showCloseButton={false}>
        <DialogTitle className='sr-only'>Create a new project</DialogTitle>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className='text-muted-foreground flex items-center gap-2 px-4 pt-3 text-xs'>
            {!orgsLoading && orgs.length > 1 ?
              <Select value={selectedOrgId || ''} onValueChange={setSelectedOrgId}>
                <SelectTrigger size='sm' aria-label='Team' className='h-6 text-xs'>
                  <SelectValue placeholder='Select a team' />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((org: { id: string; name: string }) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            : <span className='bg-muted text-muted-foreground inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 font-medium'>
                <span className='bg-primary/15 text-primary flex size-3.5 items-center justify-center rounded-sm text-[9px] font-semibold'>
                  {getInitials(resolvedOrg?.name).charAt(0)}
                </span>
                {resolvedOrg?.name}
              </span>
            }
            <ChevronRightIcon className='size-3' />
            <span>New project</span>
          </div>

          <div className='flex flex-col px-4 pt-2.5 pb-4'>
            <Input
              id='project-name'
              type='text'
              placeholder='Project name'
              aria-label='Project name'
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              autoFocus
              className='h-auto rounded-none border-0 px-0 py-1 text-lg font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-lg'
            />
          </div>

          <div className='px-4 pb-4'>
            <div className='mb-2 flex items-baseline gap-1.5 text-xs'>
              <span className='text-muted-foreground font-medium'>
                Appraisal tools you expect to use
              </span>
              <span className='text-muted-foreground/70'>optional, pick any</span>
            </div>
            <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
              {TOOLS.map(tool => {
                const selected = selectedTools.has(tool.type);
                return (
                  <button
                    key={tool.type}
                    type='button'
                    aria-pressed={selected}
                    onClick={() => toggleTool(tool.type)}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-colors',
                      selected ?
                        'border-primary bg-primary/5 ring-primary ring-1 ring-inset'
                      : 'border-border bg-card hover:border-muted-foreground/40',
                    )}
                  >
                    <span className='flex w-full items-center gap-2 text-sm font-medium'>
                      <span className={cn('size-2 shrink-0 rounded-full', tool.dotClass)} />
                      {tool.name}
                      <span
                        className={cn(
                          'ml-auto flex size-3.5 items-center justify-center rounded-[3px] border',
                          selected ?
                            'border-primary bg-primary text-primary-foreground'
                          : 'border-input',
                        )}
                      >
                        {selected && <CheckIcon className='size-2.5' strokeWidth={3} />}
                      </span>
                    </span>
                    <span className='text-muted-foreground text-xs leading-snug'>
                      {tool.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className='text-muted-foreground mt-3 text-xs'>
              Nothing is locked in. Any tool can be used on any study later.
            </p>
          </div>

          <div className='bg-muted/50 flex items-center justify-end gap-1.5 border-t px-4 py-2.5'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type='submit' size='sm' disabled={!canSubmit}>
              {isSubmitting ? 'Creating...' : 'Create project'}
              {!isSubmitting && (
                <span className='ml-0.5 inline-flex items-center gap-0.5 opacity-70' aria-hidden>
                  {isMac ?
                    <CommandIcon className='size-2.5' />
                  : <span className='text-[10px]'>Ctrl</span>}
                  <CornerDownLeftIcon className='size-2.5' />
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
