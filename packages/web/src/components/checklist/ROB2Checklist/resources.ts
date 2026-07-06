import type { ChecklistResources } from '../ResourcesDialog';

export const ROB2_RESOURCES: ChecklistResources = {
  title: 'ROB-2 Resources',
  description: 'Official guidance and documentation for the RoB 2 assessment tool.',
  links: [
    {
      title: 'RoB 2 Tool (Official)',
      description: 'Risk of Bias 2 - Assessing risk of bias in randomized trials',
      url: 'https://www.riskofbias.info/welcome/rob-2-0-tool',
    },
    {
      title: 'Detailed Guidance Document',
      description: 'Comprehensive guidance for making judgements',
      url: 'https://drive.google.com/file/d/19R9savfPdCHC8XLz2iiMvL_71lPJERWK/view',
    },
    {
      title: 'Cochrane Handbook Chapter',
      description: 'Chapter 8: Assessing risk of bias in included studies',
      url: 'https://training.cochrane.org/handbook/current/chapter-08',
    },
  ],
  autoScoringNote:
    'This tool automatically calculates domain judgements based on your signalling question responses, following the official RoB 2 decision algorithms.',
};
