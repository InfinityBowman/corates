export const PROJECT_SETUP_STATUSES = ['in_progress', 'completed', 'dismissed'] as const;
export type ProjectSetupStatus = (typeof PROJECT_SETUP_STATUSES)[number];

export const PROJECT_SETUP_STEPS = ['studies', 'team', 'distribution'] as const;
export type ProjectSetupStep = (typeof PROJECT_SETUP_STEPS)[number];

export function projectSetupStepIndex(step: ProjectSetupStep | null | undefined): number {
  if (!step) return 0;
  const index = PROJECT_SETUP_STEPS.indexOf(step);
  return index >= 0 ? index : 0;
}
