/**
 * ContactPrompt Component
 * Prompts users to contact for early access when they cannot create projects
 */

import { FiMail } from 'solid-icons/fi';
import { LANDING_URL } from '@config/api.js';

export default function ContactPrompt(props) {
  const restrictionType = () => props.restrictionType ?? 'entitlement';
  const projectCount = () => props.projectCount ?? 0;
  const quotaLimit = () => props.quotaLimit ?? null;

  const contactUrl = () => `${LANDING_URL}/contact`;

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
    <div class='rounded-lg border border-blue-200 bg-white p-4'>
      <div class='flex items-start space-x-3'>
        <div class='shrink-0'>
          <div class='flex h-10 w-10 items-center justify-center rounded-full bg-blue-100'>
            <FiMail class='h-5 w-5 text-blue-600' />
          </div>
        </div>
        <div class='min-w-0 flex-1'>
          <h3 class='text-sm font-medium text-blue-800'>{getTitle()}</h3>
          <p class='mt-1 text-sm text-blue-600'>{getMessage()}</p>
          <a
            href={contactUrl()}
            target='_blank'
            rel='noopener noreferrer'
            class='mt-3 inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
          >
            <FiMail class='mr-1 h-4 w-4' />
            Request Early Access
          </a>
        </div>
      </div>
    </div>
  );
}
