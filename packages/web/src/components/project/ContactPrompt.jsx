/**
 * ContactPrompt Component
 * Prompts users to contact for early access when they cannot create projects
 */

import { LANDING_URL } from '@config/api.js';

export default function ContactPrompt(props) {
  const restrictionType = () => props.restrictionType ?? 'entitlement';
  const projectCount = () => props.projectCount ?? 0;
  const quotaLimit = () => props.quotaLimit ?? null;

  const contactUrl = () => {
    if (LANDING_URL) {
      return `${LANDING_URL}/contact`;
    }
    return '/contact';
  };

  const getTitle = () => {
    if (restrictionType() === 'entitlement') {
      return 'Early Access Testing';
    }
    return 'Project Limit Reached';
  };

  const getMessage = () => {
    if (restrictionType() === 'entitlement') {
      return `CoRATES is currently in early access testing as we test and refine project-based features in collaboration with early users. If you're interested in creating a project and sharing feedback, please contact us to request access. Individual appraisals are always available and free to use.`;
    }
    const limit = quotaLimit();
    const limitText = limit === null || limit === -1 ? '∞' : limit;
    return `You've reached your project limit (${projectCount()}/${limitText}). Request early access for more projects.`;
  };

  return (
    <div class='flex items-center justify-between rounded-lg border border-blue-200 bg-white p-4'>
      <div>
        <p class='font-medium text-blue-800'>{getTitle()}</p>
        <p class='text-sm text-blue-600'>{getMessage()}</p>
      </div>
      <a
        href={contactUrl()}
        target='_blank'
        rel='noopener noreferrer'
        class='ml-4 rounded-lg bg-blue-600 px-4 py-2 font-medium whitespace-nowrap text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
      >
        Contact Us
      </a>
    </div>
  );
}
