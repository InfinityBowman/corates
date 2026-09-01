import { PROJECT_SETUP_STEPS, projectSetupStepIndex, type ProjectSetupStep } from '@corates/shared';

export interface SetupStepDefinition {
  id: ProjectSetupStep;
  title: string;
  emptySubtitle: string;
}

export const SETUP_STEPS: SetupStepDefinition[] = [
  {
    id: 'studies',
    title: 'Add your studies',
    emptySubtitle: 'Nothing added yet',
  },
  {
    id: 'team',
    title: 'Invite your reviewers',
    emptySubtitle: 'Just you so far',
  },
  {
    id: 'distribution',
    title: 'Share out the work',
    emptySubtitle: 'Needs studies first',
  },
];

export function setupStepNumber(step: ProjectSetupStep): number {
  return projectSetupStepIndex(step) + 1;
}

export function getPreviousSetupStep(current: ProjectSetupStep): ProjectSetupStep | null {
  const index = projectSetupStepIndex(current);
  return index > 0 ? PROJECT_SETUP_STEPS[index - 1] : null;
}
