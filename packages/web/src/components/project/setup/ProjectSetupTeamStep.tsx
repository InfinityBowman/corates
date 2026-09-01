/**
 * Step 2 - invite reviewers by email during project setup.
 *
 * Chips are edited locally and synced to the server as draft invitations after a debounce,
 * so leaving and returning to this step restores them.
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { queryKeys } from '@/lib/queryKeys';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useProjectContext } from '../ProjectContext';
import { syncSetupInvites, updateProjectSetup } from '@/server/functions/org-projects.functions';
import { EmailChipInput, type EmailChip } from './EmailChipInput';
import { ProjectSetupStepFooter } from './ProjectSetupStepFooter';
import { ProjectSetupStepHeader } from './ProjectSetupStepHeader';

interface ProjectSetupTeamStepProps {
  orgId: string;
  initialInvites: EmailChip[];
  onStepComplete: () => void;
  onBack: () => void;
  isNavigating: boolean;
}

type Busy = 'idle' | 'saving' | 'continuing' | 'skipping';

function chipKey(chips: EmailChip[]): string {
  return chips
    .map(chip => chip.email)
    .sort()
    .join(',');
}

export function ProjectSetupTeamStep({
  orgId,
  initialInvites,
  onStepComplete,
  onBack,
  isNavigating,
}: ProjectSetupTeamStepProps) {
  const { projectId } = useProjectContext();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore(selectUser);

  const [chips, setChips] = useState<EmailChip[]>(initialInvites);
  const [busy, setBusy] = useState<Busy>('idle');
  const lastSyncedKeyRef = useRef(chipKey(initialInvites));
  const debouncedChips = useDebouncedValue(chips, 400);

  const syncChips = async (next: EmailChip[]) => {
    if (chipKey(next) === lastSyncedKeyRef.current) return;
    const result = await syncSetupInvites({
      data: { orgId, projectId, emails: next.map(chip => chip.email) },
    });
    lastSyncedKeyRef.current = chipKey(next);
    setChips(result.invites);
    queryClient.setQueryData(queryKeys.projects.setupInvites(projectId), result.invites);
  };

  useEffect(() => {
    if (chipKey(debouncedChips) === lastSyncedKeyRef.current) return;
    (async () => {
      setBusy('saving');
      try {
        await syncChips(debouncedChips);
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Could Not Save Invites' });
      } finally {
        setBusy('idle');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedChips]);

  const finishStep = async (skipInvites: boolean) => {
    setBusy(skipInvites ? 'skipping' : 'continuing');
    try {
      await syncChips(skipInvites ? [] : chips);
      await updateProjectSetup({
        data: { orgId, projectId, setupSkipInvites: skipInvites, setupStep: 'distribution' },
      });
      onStepComplete();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, {
        toastTitle: skipInvites ? 'Could Not Skip Step' : 'Could Not Continue',
      });
    } finally {
      setBusy('idle');
    }
  };

  const ownerEmail = currentUser?.email?.toLowerCase() ?? '';
  const handleChipsChange = (nextChips: EmailChip[]) => {
    const filtered = nextChips.filter(chip => chip.email !== ownerEmail);
    if (filtered.length !== nextChips.length) {
      showToast.warning('Cannot Invite Yourself', 'You are already the project owner.');
    }
    setChips(filtered);
  };

  const existingCount = chips.filter(chip => chip.isExistingUser).length;
  const newCount = chips.length - existingCount;
  const isBusy = busy !== 'idle' || isNavigating;

  return (
    <div className='flex min-h-0 flex-1 flex-col px-10 py-8'>
      <ProjectSetupStepHeader step='team' title='Who else is appraising?'>
        Each study gets two independent appraisals. Invite the people doing them, and they&apos;ll
        be waiting when you share out the work in the next step.
      </ProjectSetupStepHeader>

      <div className='mt-6 max-w-xl'>
        <p className='text-foreground text-sm font-semibold'>Email addresses</p>
        <div className='mt-2'>
          <EmailChipInput
            chips={chips}
            onChange={handleChipsChange}
            disabled={busy === 'continuing'}
          />
        </div>
        {chips.length > 0 && (
          <p className='text-muted-foreground mt-2 text-xs'>
            {existingCount > 0 &&
              `${existingCount} ${existingCount === 1 ? 'person' : 'people'} already ${existingCount === 1 ? 'uses' : 'use'} CoRATES`}
            {existingCount > 0 && newCount > 0 && ', '}
            {newCount > 0 &&
              `${newCount} will get ${newCount === 1 ? 'a sign-up link' : 'sign-up links'}`}
          </p>
        )}

        <p className='text-muted-foreground mt-4 text-sm'>
          Not inviting anyone right now?{' '}
          <button
            type='button'
            onClick={() => void finishStep(true)}
            disabled={isBusy}
            className='text-primary font-semibold hover:underline disabled:opacity-50'
          >
            {busy === 'skipping' ? 'Skipping...' : 'Skip inviting for now'}
          </button>
        </p>
      </div>

      <ProjectSetupStepFooter
        hint={busy === 'saving' ? 'Saving...' : 'Invitations send when you finish setup'}
        backLabel='Back to studies'
        onBack={onBack}
        backDisabled={isBusy}
        primaryLabel='Continue'
        onPrimary={() => void finishStep(false)}
        primaryDisabled={isBusy}
        isLoading={busy === 'continuing'}
      />
    </div>
  );
}
