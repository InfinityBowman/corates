/** Checklists offered as quick starts for a new local appraisal. */
export const CHECKLIST_QUICK_STARTS = [
  {
    type: 'AMSTAR2',
    name: 'AMSTAR 2',
    description: 'Quality of systematic reviews',
    dotClass: 'bg-blue-500',
  },
  {
    type: 'ROB2',
    name: 'RoB 2',
    description: 'Risk of bias in randomized trials',
    dotClass: 'bg-violet-500',
  },
  {
    type: 'ROBINS_I',
    name: 'ROBINS-I',
    description: 'Risk of bias in non-randomized studies',
    dotClass: 'bg-emerald-500',
  },
] as const;
