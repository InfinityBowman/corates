/**
 * CreateProjectModal - Modal dialog for creating a new project
 *
 * Collects project name and organization (if user has multiple).
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, FolderIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/lib/toast';
import { useOrgs } from '@/hooks/useOrgs';
import { queryKeys } from '@/lib/queryKeys';
import { handleError, isErrorCode, getDomainError } from '@/lib/error-utils';
import { AUTH_ERRORS } from '@corates/shared';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { createProject } from '@/server/functions/org-projects.functions';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}

const INVITE_SETUP_OPTIONS = [
  {
    setupSkipInvites: false,
    title: "I'll invite reviewers",
    description: 'Add teammates during setup so you can share out the work next.',
  },
  {
    setupSkipInvites: true,
    title: 'Skip inviting for now',
    description: 'Go straight to sharing out work. You can invite people later from the project.',
  },
] as const;

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [projectName, setProjectName] = useState('');
  const [setupSkipInvites, setSetupSkipInvites] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { orgs, isLoading: orgsLoading } = useOrgs();

  useEffect(() => {
    if (orgs.length > 1 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  const resolvedOrgId = useMemo(() => {
    if (orgs.length === 1) return orgs[0].id;
    return selectedOrgId;
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    if (!open) {
      setProjectName('');
      setSetupSkipInvites(false);
      setSelectedOrgId(null);
    }
  }, [open]);

  const canSubmit = projectName.trim().length > 0 && !isSubmitting && !!resolvedOrgId;

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!projectName.trim()) return;

      const orgId = resolvedOrgId;
      if (!orgId) {
        showToast.error('Error', 'Please select an organization.');
        return;
      }

      setIsSubmitting(true);
      try {
        const newProject = (await createProject({
          data: {
            orgId,
            name: projectName.trim(),
            setupSkipInvites,
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
              'Feature Not Available',
              `This feature requires the '${details.entitlement}' entitlement. Please upgrade your plan.`,
            );
          } else if (details?.reason === 'quota_exceeded') {
            const { quotaKey, used, limit, requested } = details as Record<string, number>;
            showToast.error(
              'Quota Exceeded',
              `${quotaKey}: Current usage ${used}, Limit ${isUnlimitedQuota(limit) ? 'unlimited' : limit}, Requested ${requested}`,
            );
          } else {
            await handleError(error, { toastTitle: 'Creation Failed' });
          }
        } else {
          await handleError(error, { toastTitle: 'Creation Failed' });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [projectName, setupSkipInvites, resolvedOrgId, onOpenChange, navigate, queryClient],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <div className='flex items-center gap-3'>
            <div className='bg-primary/15 flex size-10 items-center justify-center rounded-xl'>
              <FolderIcon className='text-primary size-5' />
            </div>
            <div>
              <DialogTitle>Create a new project</DialogTitle>
              <p className='text-muted-foreground text-sm'>
                We&apos;ll walk you through adding studies and your team next.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className='flex flex-col gap-5 py-2'>
            <div>
              <Label htmlFor='project-name' className='mb-1.5'>
                What should we call this project?
              </Label>
              <Input
                id='project-name'
                type='text'
                placeholder='My Systematic Review'
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                autoFocus
              />
            </div>

            {!orgsLoading && orgs.length > 1 && (
              <div>
                <Label htmlFor='project-org' className='mb-1.5'>
                  Which team is this for?
                </Label>
                <Select value={selectedOrgId || ''} onValueChange={setSelectedOrgId}>
                  <SelectTrigger id='project-org'>
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
              </div>
            )}

            <div>
              <Label className='mb-1.5'>Will you invite reviewers during setup?</Label>
              <p className='text-muted-foreground mb-2.5 text-xs'>
                You can change this on the next step.
              </p>
              <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
                {INVITE_SETUP_OPTIONS.map(option => {
                  const selected = setupSkipInvites === option.setupSkipInvites;
                  return (
                    <button
                      key={String(option.setupSkipInvites)}
                      type='button'
                      onClick={() => setSetupSkipInvites(option.setupSkipInvites)}
                      className={cn(
                        'rounded-lg border p-3.5 text-left transition-colors',
                        selected ?
                          'border-primary bg-primary/5 ring-primary/20 ring-2'
                        : 'border-border bg-card hover:bg-muted/40',
                      )}
                    >
                      <div className='flex items-center gap-2'>
                        <span
                          className={cn(
                            'size-3.5 shrink-0 rounded-full border-2',
                            selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                          )}
                        />
                        <span className='text-sm font-semibold'>{option.title}</span>
                      </div>
                      <p className='text-muted-foreground mt-1.5 text-xs leading-relaxed'>
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={!canSubmit}>
              {isSubmitting ?
                'Creating...'
              : <>
                  Create &amp; set up
                  <ArrowRightIcon />
                </>
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
