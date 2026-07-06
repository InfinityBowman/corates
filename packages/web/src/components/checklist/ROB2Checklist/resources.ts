import type { ChecklistResources } from '../ResourcesPopover';

export const ROB2_RESOURCES: ChecklistResources = {
  title: 'ROB-2 Resources',
  description: 'Guidance for making judgements with the RoB 2 assessment tool.',
  links: [
    {
      title: 'CoRATES ROB-2 Guide',
      description: 'Overview, scoring rules, FAQs, and official references',
      url: '/resources/rob2',
    },
    {
      title: 'Detailed Guidance Document',
      description: 'Comprehensive guidance for making judgements',
      url: 'https://drive.google.com/file/d/19R9savfPdCHC8XLz2iiMvL_71lPJERWK/view',
    },
  ],
  autoScoringNote:
    'This tool automatically calculates domain judgements based on your signalling question responses, following the official RoB 2 decision algorithms.',
};
