import type { ChecklistResources } from '../ResourcesDialog';

export const AMSTAR2_RESOURCES: ChecklistResources = {
  title: 'AMSTAR 2 Resources',
  description: 'Official guidance and documentation for the AMSTAR 2 appraisal tool.',
  links: [
    {
      title: 'AMSTAR 2 Website (Official)',
      description: 'A MeaSurement Tool to Assess systematic Reviews',
      url: 'https://amstar.ca/Amstar-2.php',
    },
    {
      title: 'Detailed Guidance Document',
      description: 'Item-level explanations for making judgements',
      url: 'https://www.bmj.com/highwire/filestream/951408/field_highwire_adjunct_files/1/sheb036104.ww1.pdf',
    },
    {
      title: 'AMSTAR 2 Publication',
      description: 'Shea et al. (2017), BMJ - development and use of the tool',
      url: 'https://www.bmj.com/content/358/bmj.j4008',
    },
  ],
  autoScoringNote:
    'This tool automatically derives the overall confidence rating (High, Moderate, Low, or Critically Low) from the pattern of critical and non-critical weaknesses, following the published AMSTAR 2 decision rules.',
};
