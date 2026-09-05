// Later phases add 'team' and 'assign'. Null on the project row means setup is done.
export const PROJECT_SETUP_STEPS = ['studies'] as const;
export type ProjectSetupStep = (typeof PROJECT_SETUP_STEPS)[number];
