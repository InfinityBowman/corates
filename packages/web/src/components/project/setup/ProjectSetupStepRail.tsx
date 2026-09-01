import { CheckIcon } from 'lucide-react';
import { type ProjectSetupStep, projectSetupStepIndex } from '@corates/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SETUP_STEPS } from './setup-steps';

interface ProjectSetupStepRailProps {
  currentStep: ProjectSetupStep;
  studyCount: number;
  inviteCount: number;
  setupSkipInvites: boolean;
  onStepSelect: (step: ProjectSetupStep) => void;
  isNavigating: boolean;
}

type StepStatus = 'complete' | 'current' | 'upcoming';

function stepSubtitle(
  stepId: ProjectSetupStep,
  status: StepStatus,
  studyCount: number,
  inviteCount: number,
  setupSkipInvites: boolean,
): string {
  switch (stepId) {
    case 'studies':
      if (studyCount > 0) return `${studyCount} ${studyCount === 1 ? 'study' : 'studies'}`;
      return SETUP_STEPS[0].emptySubtitle;
    case 'team':
      if (setupSkipInvites && status !== 'current') return 'Skipping this step';
      if (status === 'complete' && inviteCount > 0) return `${inviteCount} invited`;
      if (inviteCount > 0) {
        return `${inviteCount} ${inviteCount === 1 ? 'invitation' : 'invitations'} ready to send`;
      }
      return SETUP_STEPS[1].emptySubtitle;
    case 'distribution':
      if (studyCount > 0 && status !== 'complete') return 'Ready when you are';
      return SETUP_STEPS[2].emptySubtitle;
  }
}

export function ProjectSetupStepRail({
  currentStep,
  studyCount,
  inviteCount,
  setupSkipInvites,
  onStepSelect,
  isNavigating,
}: ProjectSetupStepRailProps) {
  const currentIndex = projectSetupStepIndex(currentStep);
  const hasStudies = studyCount > 0;

  return (
    <aside className='border-border bg-muted/30 flex w-72 shrink-0 flex-col border-r px-6 py-7'>
      <p className='text-muted-foreground text-[11px] font-bold tracking-[0.09em] uppercase'>
        Setting up
      </p>
      <h2 className='text-foreground mt-2 text-xl leading-tight font-bold tracking-tight'>
        Three things and
        <br />
        you&apos;re running
      </h2>

      <div className='mt-4 flex gap-1.5'>
        {SETUP_STEPS.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              index < currentIndex ? 'bg-primary' : 'bg-border',
            )}
          />
        ))}
      </div>
      <p className='text-muted-foreground mt-2 text-[11.5px] font-semibold tabular-nums'>
        {currentIndex} of {SETUP_STEPS.length} done
      </p>

      <div className='mt-6 flex flex-col gap-1'>
        {SETUP_STEPS.map((step, index) => {
          const status: StepStatus =
            index < currentIndex ? 'complete'
            : index === currentIndex ? 'current'
            : 'upcoming';
          const subtitle = stepSubtitle(step.id, status, studyCount, inviteCount, setupSkipInvites);
          const isDistributionReady =
            step.id === 'distribution' && hasStudies && status !== 'complete';
          // Steps can be revisited freely; only distribution needs studies to exist first.
          const canSelect =
            !isNavigating && status !== 'current' && (step.id !== 'distribution' || hasStudies);

          return (
            <Button
              key={step.id}
              type='button'
              variant={status === 'current' ? 'outline' : 'ghost'}
              disabled={!canSelect}
              onClick={() => onStepSelect(step.id)}
              className={cn(
                'h-auto w-full justify-start gap-3 px-3 py-3 text-left font-normal whitespace-normal disabled:opacity-100',
                status === 'current' && 'border-primary bg-card shadow-sm',
              )}
            >
              <div
                className={cn(
                  'flex size-5.5 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold',
                  status === 'complete' && 'bg-emerald-100 text-emerald-700',
                  status === 'current' && 'bg-primary text-primary-foreground',
                  status === 'upcoming' &&
                    (step.id === 'distribution' && !hasStudies ?
                      'border-muted-foreground/40 text-muted-foreground border border-dashed'
                    : 'border-border text-muted-foreground border'),
                )}
              >
                {status === 'complete' ?
                  <CheckIcon className='size-3' strokeWidth={2.5} />
                : index + 1}
              </div>
              <div className='min-w-0'>
                <div
                  className={cn(
                    'text-sm font-semibold',
                    status === 'current' ? 'text-primary' : 'text-foreground/80',
                  )}
                >
                  {step.title}
                </div>
                <div
                  className={cn(
                    'mt-0.5 text-xs',
                    isDistributionReady ?
                      'font-semibold text-emerald-600'
                    : 'text-muted-foreground',
                  )}
                >
                  {subtitle}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
