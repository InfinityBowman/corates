/**
 * CreateProjectModal - Simple modal dialog for creating a new project
 *
 * A clean, focused modal that only collects project name (required),
 * description (optional), and organization (if user has multiple).
 */

import { createSignal, Show, createMemo, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useQueryClient } from '@tanstack/solid-query';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseTrigger,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SimpleSelect } from '@/components/ui/select';
import { showToast } from '@/components/ui/toast';
import { FiX, FiFolder } from 'solid-icons/fi';

import { apiFetch } from '@lib/apiFetch.js';
import { useOrgs } from '@primitives/useOrgs.js';
import { queryKeys } from '@lib/queryKeys.js';
import { handleError, isErrorCode } from '@/lib/error-utils.js';
import { AUTH_ERRORS } from '@corates/shared';
import { isUnlimitedQuota } from '@corates/shared/plans';

/**
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {(open: boolean) => void} props.onOpenChange - Callback when open state changes
 */
export default function CreateProjectModal(props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [projectName, setProjectName] = createSignal('');
  const [projectDescription, setProjectDescription] = createSignal('');
  const [selectedOrgId, setSelectedOrgId] = createSignal(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  // Get user's organizations
  const { orgs, isLoading: orgsLoading } = useOrgs();

  // Auto-select first org when orgs load and user has multiple
  createEffect(() => {
    const orgsList = orgs();
    if (orgsList.length > 1 && !selectedOrgId()) {
      setSelectedOrgId(orgsList[0].id);
    }
  });

  // Resolve org: auto-select if single, otherwise use selection
  const resolvedOrgId = createMemo(() => {
    const orgsList = orgs();
    if (orgsList.length === 1) {
      return orgsList[0].id;
    }
    return selectedOrgId();
  });

  // Reset form when dialog closes
  createEffect(() => {
    if (!props.open) {
      setProjectName('');
      setProjectDescription('');
      setSelectedOrgId(null);
    }
  });

  const canSubmit = () => projectName().trim().length > 0 && !isSubmitting();

  const handleSubmit = async e => {
    e?.preventDefault();

    if (!projectName().trim()) return;

    const orgId = resolvedOrgId();
    if (!orgId) {
      showToast.error('Error', 'Please select an organization.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newProject = await apiFetch.post(
        `/api/orgs/${orgId}/projects`,
        {
          name: projectName().trim(),
          description: projectDescription().trim() || undefined,
        },
        { showToast: false },
      );

      // Invalidate project list and close dialog
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      props.onOpenChange(false);

      // Navigate to new project
      navigate(`/projects/${newProject.id}`);
    } catch (error) {
      if (isErrorCode(error, AUTH_ERRORS.FORBIDDEN.code)) {
        if (error.details?.reason === 'missing_entitlement') {
          showToast.error(
            'Feature Not Available',
            `This feature requires the '${error.details.entitlement}' entitlement. Please upgrade your plan.`,
          );
        } else if (error.details?.reason === 'quota_exceeded') {
          const { quotaKey, used, limit, requested } = error.details;
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
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogBackdrop class='backdrop-blur-sm' />
      <DialogPositioner>
        <DialogContent class='relative max-w-lg rounded-2xl shadow-2xl'>
          <DialogHeader class='border-b-0 px-6 pt-6 pb-0'>
            <div class='flex items-center gap-3'>
              <div class='flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50'>
                <FiFolder class='h-5 w-5 text-blue-600' />
              </div>
              <div>
                <DialogTitle class='text-lg'>Create a new project</DialogTitle>
                <p class='text-sm text-gray-500'>
                  You can add studies and invite collaborators later.
                </p>
              </div>
            </div>
            <DialogCloseTrigger class='absolute top-4 right-4'>
              <FiX class='h-5 w-5' />
            </DialogCloseTrigger>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <DialogBody class='space-y-4 px-6 pt-5'>
              {/* Project Name */}
              <div>
                <label for='project-name' class='mb-1.5 block text-sm font-medium text-gray-700'>
                  What should we call this project?
                </label>
                <input
                  id='project-name'
                  type='text'
                  placeholder='My Systematic Review'
                  value={projectName()}
                  onInput={e => setProjectName(e.target.value)}
                  autofocus
                  class='w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-150 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none'
                />
              </div>

              {/* Organization - only show if multiple */}
              <Show when={!orgsLoading() && orgs().length > 1}>
                <div>
                  <label class='mb-1.5 block text-sm font-medium text-gray-700'>
                    Which team is this for?
                  </label>
                  <SimpleSelect
                    items={orgs().map(org => ({ value: org.id, label: org.name }))}
                    value={selectedOrgId()}
                    onChange={value => setSelectedOrgId(value)}
                    placeholder='Select a team'
                    inDialog
                  />
                </div>
              </Show>

              {/* Description */}
              <div>
                <label
                  for='project-description'
                  class='mb-1.5 block text-sm font-medium text-gray-700'
                >
                  Add a description <span class='font-normal text-gray-400'>(optional)</span>
                </label>
                <textarea
                  id='project-description'
                  placeholder='What is this review about?'
                  value={projectDescription()}
                  onInput={e => setProjectDescription(e.target.value)}
                  rows='2'
                  class='w-full resize-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-150 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none'
                />
              </div>
            </DialogBody>

            <DialogFooter class='rounded-b-2xl border-t-0 bg-transparent px-6 pb-5'>
              <Button
                type='button'
                variant='ghost'
                onClick={() => props.onOpenChange(false)}
                disabled={isSubmitting()}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={!canSubmit()}>
                {isSubmitting() ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPositioner>
    </Dialog>
  );
}
