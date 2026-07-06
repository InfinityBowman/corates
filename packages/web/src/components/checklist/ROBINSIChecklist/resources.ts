import type { ChecklistResources } from '../ResourcesPopover';

export const ROBINSI_RESOURCES: ChecklistResources = {
  title: 'ROBINS-I V2 Resources',
  description: 'Official guidance and documentation for the ROBINS-I assessment tool.',
  links: [
    {
      title: 'ROBINS-I Tool (Official)',
      description: 'Risk Of Bias In Non-randomized Studies of Interventions',
      url: 'https://www.riskofbias.info/welcome/robins-i-v2',
    },
    {
      title: 'Detailed Guidance Document',
      description: 'Comprehensive guidance for making judgements',
      url: 'https://drive.google.com/file/d/1zs85KZKFdwGcYwahvldNY_lARNv7Nqsr/view',
    },
    {
      title: 'Cochrane Handbook Chapter',
      description: 'Chapter 25: Assessing risk of bias in non-randomized studies',
      url: 'https://training.cochrane.org/handbook/current/chapter-25',
    },
  ],
  autoScoringNote:
    'This tool automatically calculates domain judgements based on your signalling question responses, following the official ROBINS-I decision algorithms.',
};
