/**
 * ProjectSetupPanel - First-run setup for an empty project.
 *
 * Shown on the Studies tab to the owner until studies exist or setup is
 * dismissed. Every step is always visible and opens the same sheet the
 * project header does; nothing is required before moving on.
 */

import { useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useAllStudies,
  useProjectMembers,
  useProjectMeta,
  useProjectOutcomes,
} from '@/project/workspace-data';
import { useMembers } from '@/hooks/useMembers';
import { useSubscription } from '@/hooks/useSubscription';
import { useProjectContext } from '../ProjectContext';
import { AddMemberModal } from '../overview-tab/AddMemberModal';

interface SetupStep {
  key: string;
  title: string;
  description: string;
  cta: string;
  done: boolean;
  lockReason: string | null;
  onOpen: () => void;
}

export function ProjectSetupPanel() {
  const { projectId, orgId, setAddStudiesSheetOpen, setAssignSheetOpen, setOutcomesSheetOpen } =
    useProjectContext();
  const meta = useProjectMeta(projectId);
  const studies = useAllStudies(projectId);
  const outcomes = useProjectOutcomes(projectId);
  const members = useProjectMembers(projectId);
  const { quotas } = useSubscription();
  const { members: orgMembers } = useMembers();
  const [inviteOpen, setInviteOpen] = useState(false);

  const collaboratorQuotaInfo = {
    used: orgMembers.filter(m => m.role !== 'owner').length,
    max: quotas['collaborators.org.max'] ?? 0,
  };

  const hasStudies = studies.length > 0;
  const hasTeam = members.length > 1;

  const steps: SetupStep[] = [
    {
      key: 'studies',
      title: 'Add studies',
      description:
        'Upload PDFs, import a reference file, paste DOIs or PubMed IDs, or pull from Google Drive.',
      cta: 'Add studies',
      done: hasStudies,
      lockReason: null,
      onOpen: () => setAddStudiesSheetOpen(true),
    },
    {
      key: 'outcomes',
      title: 'Define outcomes',
      description:
        'RoB 2 and ROBINS-I judge each outcome separately. Add them now, or when a reviewer needs one.',
      cta: 'Add outcomes',
      done: outcomes.length > 0,
      lockReason: null,
      onOpen: () => setOutcomesSheetOpen(true),
    },
    {
      key: 'team',
      title: 'Invite your co-reviewers',
      description: 'Two reviewers appraise each study independently. You count as one.',
      cta: 'Invite',
      done: hasTeam,
      lockReason: null,
      onOpen: () => setInviteOpen(true),
    },
    {
      key: 'assign',
      title: 'Assign reviewers',
      description: 'Split the studies across the team. Everyone is notified once.',
      cta: 'Assign',
      done: false,
      lockReason:
        !hasStudies ? 'Needs studies'
        : !hasTeam ? 'Needs a second member'
        : null,
      onOpen: () => setAssignSheetOpen(true),
    },
  ];
  const activeKey = steps.find(step => !step.done && !step.lockReason)?.key;

  return (
    <div className='mx-auto max-w-2xl py-10'>
      <p className='text-muted-foreground text-xs'>Project created, nothing here yet</p>
      <h2 className='text-foreground mt-1 text-xl font-semibold tracking-tight'>
        Set up {meta.name}
      </h2>
      <p className='text-muted-foreground mt-1.5 max-w-lg text-sm'>
        Four steps, in any order. Everything is editable later, and you can leave and come back.
      </p>

      <ol className='border-border bg-card mt-6 divide-y overflow-hidden rounded-xl border'>
        {steps.map((step, index) => {
          const active = step.key === activeKey;
          return (
            <li
              key={step.key}
              className={cn('flex items-center gap-4 px-4 py-3.5', active && 'bg-primary/5')}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold',
                  step.done ? 'border-success bg-success text-success-foreground'
                  : active ? 'border-primary text-primary'
                  : 'border-muted-foreground/40 text-muted-foreground border-dashed',
                )}
              >
                {step.done ?
                  <CheckIcon className='size-3' strokeWidth={3} />
                : index + 1}
              </span>
              <div className='min-w-0 flex-1'>
                <p
                  className={cn(
                    'text-sm font-medium',
                    step.done ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {step.title}
                </p>
                <p className='text-muted-foreground mt-0.5 text-xs'>{step.description}</p>
              </div>
              {step.lockReason ?
                <span className='text-muted-foreground/70 shrink-0 text-xs'>{step.lockReason}</span>
              : <Button
                  size='sm'
                  variant={active ? 'default' : 'outline'}
                  onClick={step.onOpen}
                  className='shrink-0'
                >
                  {step.cta}
                </Button>
              }
            </li>
          );
        })}
      </ol>

      <AddMemberModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        projectId={projectId}
        orgId={orgId}
        quotaInfo={collaboratorQuotaInfo}
      />
    </div>
  );
}
