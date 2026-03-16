/**
 * CreateProjectModal - Modal dialog for creating a new project
 *
 * Collects project name (required), description (optional),
 * and organization (if user has multiple).
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { FolderIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/apiFetch';
import { useOrgs } from '@/hooks/useOrgs';
import { queryKeys } from '@/lib/queryKeys';
import { handleError, isErrorCode } from '@/lib/error-utils';
import { AUTH_ERRORS } from '@corates/shared';
import { isUnlimitedQuota } from '@corates/shared/plans';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}

interface CreateProjectResponse {
  id: string;
  name: string;
}

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { orgs, isLoading: orgsLoading } = useOrgs();

  // Auto-select first org when orgs load and user has multiple
  useEffect(() => {
    if (orgs.length > 1 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  // Resolve org: auto-select if single, otherwise use selection
  const resolvedOrgId = useMemo(() => {
    if (orgs.length === 1) return orgs[0].id;
    return selectedOrgId;
  }, [orgs, selectedOrgId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setProjectName('');
      setProjectDescription('');
      setSelectedOrgId(null);
    }
  }, [open]);

  const canSubmit = projectName.trim().length > 0 && !isSubmitting;

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
        const newProject = await apiFetch.post<CreateProjectResponse>(
          `/api/orgs/${orgId}/projects`,
          {
            name: projectName.trim(),
            description: projectDescription.trim() || undefined,
          },
          { showToast: false },
        );

        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        onOpenChange(false);

        navigate({ to: `/projects/${newProject.id}` as string });
      } catch (error: any) {
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
    },
    [projectName, projectDescription, resolvedOrgId, onOpenChange, navigate, queryClient],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <FolderIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle>Create a new project</DialogTitle>
              <p className="text-muted-foreground text-sm">
                You can add studies and invite collaborators later.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            {/* Project Name */}
            <div>
              <label
                htmlFor="project-name"
                className="text-secondary-foreground mb-1.5 block text-sm font-medium"
              >
                What should we call this project?
              </label>
              <input
                id="project-name"
                type="text"
                placeholder="My Systematic Review"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                autoFocus
                className="border-border bg-card text-foreground placeholder-muted-foreground/70 focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-sm transition-all duration-150 focus:ring-2 focus:outline-none"
              />
            </div>

            {/* Organization - only show if multiple */}
            {!orgsLoading && orgs.length > 1 && (
              <div>
                <label className="text-secondary-foreground mb-1.5 block text-sm font-medium">
                  Which team is this for?
                </label>
                <Select value={selectedOrgId || ''} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
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

            {/* Description */}
            <div>
              <label
                htmlFor="project-description"
                className="text-secondary-foreground mb-1.5 block text-sm font-medium"
              >
                Add a description{' '}
                <span className="text-muted-foreground/70 font-normal">(optional)</span>
              </label>
              <textarea
                id="project-description"
                placeholder="What is this review about?"
                value={projectDescription}
                onChange={e => setProjectDescription(e.target.value)}
                rows={2}
                className="border-border bg-card text-foreground placeholder-muted-foreground/70 focus:border-primary focus:ring-primary/20 w-full resize-none rounded-lg border px-3.5 py-2.5 text-sm shadow-sm transition-all duration-150 focus:ring-2 focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
