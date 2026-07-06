import type { ChecklistResources } from '../ResourcesPopover';

export const AMSTAR2_RESOURCES: ChecklistResources = {
  title: 'AMSTAR 2 Resources',
  description: 'Guidance for making judgements with the AMSTAR 2 appraisal tool.',
  links: [
    {
      title: 'CoRATES AMSTAR 2 Guide',
      description: 'Overview, rating rules, FAQs, and official references',
      url: '/resources/amstar2',
    },
    {
      title: 'Detailed Guidance Document',
      description: 'Item-level explanations for making judgements',
      url: 'https://www.bmj.com/highwire/filestream/951408/field_highwire_adjunct_files/1/sheb036104.ww1.pdf',
    },
  ],
  autoScoringNote:
    'This tool automatically derives the overall confidence rating (High, Moderate, Low, or Critically Low) from the pattern of critical and non-critical weaknesses, following the published AMSTAR 2 decision rules.',
};
