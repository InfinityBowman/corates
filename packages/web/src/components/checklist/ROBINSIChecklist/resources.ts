import type { ChecklistResources } from '../ResourcesPopover';

export const ROBINSI_RESOURCES: ChecklistResources = {
  title: 'ROBINS-I V2 Resources',
  description: 'Guidance for making judgements with the ROBINS-I assessment tool.',
  links: [
    {
      title: 'CoRATES ROBINS-I Guide',
      description: 'Overview, scoring rules, FAQs, and official references',
      url: '/resources/robins-i',
    },
    {
      title: 'Detailed Guidance Document',
      description: 'Comprehensive guidance for making judgements',
      url: 'https://drive.google.com/file/d/1zs85KZKFdwGcYwahvldNY_lARNv7Nqsr/view',
    },
  ],
  autoScoringNote:
    'This tool automatically calculates domain judgements based on your signalling question responses, following the official ROBINS-I decision algorithms.',
};
