/**
 * Onboarding step that names the workspace created for the user at signup,
 * as in Linear's "create your workspace" step. Skipping keeps the generated
 * name and URL, which can be changed later in workspace settings.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepsPrevTrigger } from '@/components/ui/steps';
import { ErrorMessage } from '@/components/auth/ErrorMessage';
import { PrimaryButton } from '@/components/auth/AuthButtons';
import { WorkspaceUrlField } from '@/components/workspace/WorkspaceUrlField';
import { useWorkspaces, type Workspace } from '@/hooks/useWorkspaces';
import { useWorkspaceDraft } from '@/hooks/useWorkspaceDraft';

export interface WorkspaceChanges {
  orgId: string;
  name?: string;
  slug?: string;
}

interface WorkspaceStepProps {
  firstName: string;
  loading: boolean;
  error: string;
  onFinish: (changes: WorkspaceChanges | null) => void;
}

export function WorkspaceStep(props: WorkspaceStepProps) {
  const { workspaces, isLoading } = useWorkspaces();
  const owned = workspaces.find(w => w.role === 'owner');

  if (isLoading) return null;
  // Without a workspace to name (its creation failed at signup) there is nothing
  // to ask; finishing still works and the dashboard falls back.
  if (!owned) {
    return (
      <StepFrame>
        <PrimaryButton type='button' loading={props.loading} onClick={() => props.onFinish(null)}>
          Finish Setup
        </PrimaryButton>
      </StepFrame>
    );
  }
  return <WorkspaceForm {...props} workspace={owned} />;
}

function StepFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className='mb-5 text-center'>
        <h2 className='text-foreground mb-1 text-xl font-bold sm:text-2xl'>Name your workspace</h2>
        <p className='text-muted-foreground text-xs sm:text-sm'>
          Your projects and the people you appraise with live here. You can change this later.
        </p>
      </div>
      {children}
    </>
  );
}

function WorkspaceForm({
  workspace,
  firstName,
  loading,
  error,
  onFinish,
}: WorkspaceStepProps & { workspace: Workspace }) {
  const suggestedName = firstName.trim() ? `${firstName.trim()}'s Workspace` : workspace.name;
  const draft = useWorkspaceDraft({
    name: suggestedName,
    slug: workspace.slug,
    orgId: workspace.id,
    slugFromName: suggestedName !== workspace.name,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.ready) return;
    const name = draft.name.trim();
    onFinish({
      orgId: workspace.id,
      ...(name !== workspace.name && { name }),
      ...(draft.slug !== workspace.slug && { slug: draft.slug }),
    });
  }

  return (
    <StepFrame>
      <form onSubmit={handleSubmit} className='flex flex-col gap-4' autoComplete='off'>
        <div>
          <Label className='mb-1' htmlFor='workspace-name-input'>
            Workspace name
          </Label>
          <Input
            id='workspace-name-input'
            value={draft.name}
            onChange={e => draft.setName(e.target.value)}
            className='h-auto py-2 text-sm'
            maxLength={80}
          />
          <p className='text-muted-foreground mt-1 text-xs'>
            Most teams use their lab, department, or review group.
          </p>
        </div>

        <div>
          <Label className='mb-1' htmlFor='workspace-url-input'>
            Workspace URL
          </Label>
          <WorkspaceUrlField
            id='workspace-url-input'
            value={draft.slugInput}
            onChange={draft.setSlug}
            status={draft.status}
          />
        </div>

        <ErrorMessage error={error} id='profile-step4-error' />

        <div className='flex gap-3'>
          <StepsPrevTrigger asChild>
            <Button
              type='button'
              variant='outline'
              className='h-auto flex-1 rounded-lg py-2 font-semibold sm:rounded-xl sm:py-3 sm:text-base'
            >
              Back
            </Button>
          </StepsPrevTrigger>
          <PrimaryButton
            loading={loading}
            loadingText='Finishing...'
            disabled={!draft.ready}
            className='flex-3'
          >
            Finish Setup
          </PrimaryButton>
        </div>

        <Button
          type='button'
          variant='link'
          onClick={() => onFinish(null)}
          disabled={loading}
          className='text-muted-foreground hover:text-secondary-foreground mx-auto -mt-2'
        >
          Skip for now
        </Button>
      </form>
    </StepFrame>
  );
}
