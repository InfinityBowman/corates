/**
 * ProjectSetupCard - Compact setup checklist shown above the study list once
 * studies exist, until the owner finishes or dismisses setup.
 */

import { useState } from 'react';
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/components/ui/avatar';
import { showToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { project } from '@/project';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { AddMemberModal } from '../overview-tab/AddMemberModal';
import { useProjectSetup, type SetupStep } from './useProjectSetup';

export function ProjectSetupCard() {
  const setup = useProjectSetup();
  const { steps, activeKey, doneCount, dismiss, isDismissing } = setup;

  return (
    <div className='border-border bg-card mb-6 overflow-hidden rounded-xl border'>
      <div className='bg-muted/50 flex h-10 items-center gap-2.5 border-b px-3.5'>
        <span className='text-sm font-semibold'>Setup</span>
        <span className='text-muted-foreground text-xs'>
          {doneCount} of {steps.length} done
        </span>
        <div className='ml-1 flex gap-1'>
          {steps.map(step => (
            <span
              key={step.key}
              className={cn(
                'block h-1 w-5 rounded-full',
                step.done ? 'bg-success'
                : step.key === activeKey ? 'bg-primary'
                : 'bg-border',
              )}
            />
          ))}
        </div>
        <Button
          variant='ghost'
          size='xs'
          className='text-muted-foreground ml-auto'
          onClick={dismiss}
          disabled={isDismissing}
        >
          Finish later
        </Button>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'>
        {steps.map((step, index) => (
          <div
            key={step.key}
            className='border-border flex min-w-0 flex-col gap-2 border-b p-3.5 sm:border-r xl:border-b-0 xl:nth-[4n]:border-r-0'
          >
            <StepHeading step={step} index={index} active={step.key === activeKey} />
            {step.key === 'studies' && <StudiesBody setup={setup} />}
            {step.key === 'outcomes' && <OutcomesBody setup={setup} />}
            {step.key === 'team' && <TeamBody setup={setup} />}
            {step.key === 'assign' && <AssignBody setup={setup} />}
          </div>
        ))}
      </div>

      <AddMemberModal
        isOpen={setup.inviteOpen}
        onClose={() => setup.setInviteOpen(false)}
        projectId={setup.projectId}
        orgId={setup.orgId}
        quotaInfo={setup.collaboratorQuotaInfo}
      />
    </div>
  );
}

type Setup = ReturnType<typeof useProjectSetup>;

function StepHeading({ step, index, active }: { step: SetupStep; index: number; active: boolean }) {
  return (
    <div className='flex items-center gap-2'>
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold',
          step.done ? 'border-success bg-success text-success-foreground'
          : active ? 'border-primary text-primary'
          : 'border-muted-foreground/40 text-muted-foreground border-dashed',
        )}
      >
        {step.done ?
          <CheckIcon className='size-2.5' strokeWidth={3} />
        : index + 1}
      </span>
      <span
        className={cn(
          'text-xs font-medium',
          step.done ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {step.title}
      </span>
    </div>
  );
}

function StudiesBody({ setup }: { setup: Setup }) {
  const count = setup.studies.length;
  const withPdf = setup.studies.filter(s => s.pdfs && s.pdfs.length > 0).length;
  return (
    <>
      <p className='text-muted-foreground text-xs'>
        {count} {count === 1 ? 'study' : 'studies'} added, {withPdf} with PDFs
      </p>
      <Button variant='outline' size='xs' className='self-start' onClick={setup.steps[0].onOpen}>
        <PlusIcon />
        Add more
      </Button>
    </>
  );
}

function OutcomesBody({ setup }: { setup: Setup }) {
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const add = async () => {
    const name = draft.trim();
    if (!name || isSaving) return;
    setIsSaving(true);
    try {
      const id = await project.outcome.create(name);
      if (id) setDraft('');
      else showToast.error('Could not add the outcome');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = (outcomeId: string) => {
    const result = project.outcome.delete(outcomeId);
    if (!result.success) showToast.error(result.error ?? 'Could not remove the outcome');
  };

  return (
    <>
      <p className='text-muted-foreground text-xs'>
        {setup.outcomes.length > 0 ?
          'Reviewers pick from this list when they start a RoB 2 or ROBINS-I checklist.'
        : 'Only needed for RoB 2 or ROBINS-I. Safe to skip for now.'}
      </p>
      <div className='flex flex-wrap items-center gap-1'>
        {setup.outcomes.map(outcome => (
          <span
            key={outcome.id}
            className='border-border bg-muted/50 inline-flex h-6 items-center gap-1 rounded-md border pr-1 pl-2 text-xs font-medium'
          >
            {outcome.name}
            <button
              type='button'
              aria-label={`Remove ${outcome.name}`}
              onClick={() => remove(outcome.id)}
              className='text-muted-foreground hover:bg-border hover:text-foreground flex size-4 items-center justify-center rounded-sm'
            >
              <XIcon className='size-2.5' strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add();
            }
          }}
          disabled={isSaving}
          placeholder={
            setup.outcomes.length > 0 ? 'Add another' : 'Type an outcome and press Enter'
          }
          aria-label='New outcome'
          className='border-input placeholder:text-muted-foreground focus-visible:border-ring h-6 min-w-32 flex-1 rounded-md border border-dashed bg-transparent px-2 text-xs outline-none'
        />
      </div>
    </>
  );
}

function TeamBody({ setup }: { setup: Setup }) {
  const user = useAuthStore(selectUser);
  return (
    <>
      <div className='flex flex-col gap-1'>
        {setup.members.map(member => {
          const isSelf = member.userId === user?.id;
          const label = member.name || member.email;
          return (
            <div key={member.userId} className='flex items-center gap-2'>
              <span className='bg-primary/15 text-primary text-3xs flex size-4.5 shrink-0 items-center justify-center rounded-full font-semibold'>
                {getInitials(label)}
              </span>
              <span className='text-foreground min-w-0 flex-1 truncate text-xs'>
                {label}
                {isSelf && <span className='text-muted-foreground'> (you)</span>}
              </span>
              <span
                className={cn(
                  'text-[11px]',
                  member.role === 'owner' ? 'text-muted-foreground' : 'text-success',
                )}
              >
                {member.role === 'owner' ? 'Lead' : 'Joined'}
              </span>
            </div>
          );
        })}
        {setup.invitations.map(invitation => (
          <div key={invitation.id} className='flex items-center gap-2'>
            <span className='border-muted-foreground/40 text-muted-foreground text-3xs flex size-4.5 shrink-0 items-center justify-center rounded-full border border-dashed font-semibold'>
              {getInitials(invitation.email)}
            </span>
            <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
              {invitation.email}
            </span>
            <span className='text-muted-foreground text-[11px]'>Invited</span>
          </div>
        ))}
      </div>
      <Button
        variant='outline'
        size='xs'
        className='self-start'
        onClick={() => setup.setInviteOpen(true)}
      >
        <PlusIcon />
        {setup.hasTeam || setup.hasInvited ? 'Invite another' : 'Invite'}
      </Button>
    </>
  );
}

function AssignBody({ setup }: { setup: Setup }) {
  const assign = setup.steps[3];
  const count = setup.studies.length;
  if (assign.lockReason) {
    return <p className='text-muted-foreground text-xs'>Needs at least one more member.</p>;
  }
  if (assign.done) {
    return (
      <>
        <p className='text-muted-foreground text-xs'>
          {count} {count === 1 ? 'study' : 'studies'}, 2 reviewers each
        </p>
        <p className='text-success flex items-center gap-1 text-xs'>
          <CheckIcon className='size-3' strokeWidth={2.5} />
          Reviewers assigned
        </p>
      </>
    );
  }
  return (
    <>
      <p className='text-muted-foreground text-xs'>
        {count} {count === 1 ? 'study' : 'studies'}, {setup.members.length} members
      </p>
      <Button size='xs' className='self-start' onClick={assign.onOpen}>
        Assign {count} {count === 1 ? 'study' : 'studies'}
      </Button>
    </>
  );
}
