/**
 * The parts of a per-outcome appraisal that describe the study rather than
 * the outcome, and so may be copied between a reviewer's own appraisals of
 * the same study on different outcomes.
 *
 * Everything absent here is assessed per outcome and always starts blank:
 * the numerical result, RoB 2 domains 3 to 5, ROBINS-I section A (the
 * result), section B (which asks about the outcome's measurement), domains
 * 4 to 6, and the overall judgement.
 */
export interface CarryOverSection {
  id: string;
  label: string;
  /** Exact flat answer keys in this section. */
  keys?: string[];
  /** Flat-key prefixes; every default row starting with one belongs here. */
  prefixes?: string[];
  /**
   * Keys the source and target must agree on for this section to apply: the
   * RoB 2 aim decides whether domain 2a or 2b is being assessed, and the
   * ROBINS-I effect of interest does the same for domain 1a and 1b.
   */
  requiresMatch?: string[];
}

export const CARRY_OVER_SECTIONS: Record<'ROB2' | 'ROBINS_I', CarryOverSection[]> = {
  ROB2: [
    {
      id: 'preliminary',
      label: 'Preliminary considerations',
      keys: [
        'preliminary.studyDesign',
        'preliminary.experimental',
        'preliminary.comparator',
        'preliminary.aim',
        'preliminary.deviationsToAddress',
        'preliminary.sources',
      ],
    },
    { id: 'domain1', label: 'Domain 1', prefixes: ['d1_', 'domain1.'] },
    {
      id: 'domain2',
      label: 'Domain 2',
      prefixes: ['d2a_', 'd2b_', 'domain2a.', 'domain2b.'],
      requiresMatch: ['preliminary.aim'],
    },
  ],
  ROBINS_I: [
    {
      id: 'planning',
      label: 'Planning and confounding factors',
      prefixes: ['planning.', 'confoundingEvaluation.'],
    },
    { id: 'sectionC', label: 'Section C', prefixes: ['sectionC.'] },
    { id: 'sectionD', label: 'Section D', prefixes: ['sectionD.'] },
    {
      id: 'domain1',
      label: 'Domain 1',
      prefixes: ['d1a_', 'd1b_', 'domain1a.', 'domain1b.'],
      requiresMatch: ['sectionC.isPerProtocol'],
    },
    { id: 'domain2', label: 'Domain 2', prefixes: ['d2_', 'domain2.'] },
    { id: 'domain3', label: 'Domain 3', prefixes: ['d3_', 'domain3.'] },
  ],
};
