import type { ReactNode } from 'react';
import type { ProjectSetupStep } from '@corates/shared';
import { SETUP_STEPS, setupStepNumber } from './setup-steps';

interface ProjectSetupStepHeaderProps {
  step: ProjectSetupStep;
  title: string;
  children?: ReactNode;
}

export function ProjectSetupStepHeader({ step, title, children }: ProjectSetupStepHeaderProps) {
  return (
    <>
      <p className='text-primary text-[11.5px] font-bold tracking-[0.08em] uppercase tabular-nums'>
        Step {setupStepNumber(step)} of {SETUP_STEPS.length}
      </p>
      <h1 className='text-foreground mt-2 text-3xl font-bold tracking-tight'>{title}</h1>
      {children && (
        <p className='text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed'>{children}</p>
      )}
    </>
  );
}
