/**
 * ContactPrompt - Prompts users to contact for early access when they cannot create projects
 */

interface ContactPromptProps {
  restrictionType: 'entitlement' | 'quota' | null;
  projectCount: number;
  quotaLimit?: number | null;
}

export function ContactPrompt({ restrictionType, projectCount, quotaLimit }: ContactPromptProps) {
  const title =
    restrictionType === 'entitlement' ? 'Early Access Testing' : 'Project Limit Reached';

  const message =
    restrictionType === 'entitlement'
      ? "CoRATES is currently in early access testing as we test and refine project-based features in collaboration with early users. If you're interested in creating a project and sharing feedback, please contact us to request access. Individual appraisals are always available and free to use."
      : `You've reached your project limit (${projectCount}/${quotaLimit === null || quotaLimit === -1 ? 'unlimited' : quotaLimit}). Request early access for more projects.`;

  return (
    <div className="bg-card flex items-center justify-between rounded-lg border border-blue-200 p-4">
      <div>
        <p className="font-medium text-blue-800">{title}</p>
        <p className="text-sm text-blue-600">{message}</p>
      </div>
      <a
        href="/contact"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-primary hover:bg-primary/90 ml-4 rounded-lg px-4 py-2 font-medium whitespace-nowrap text-white transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
      >
        Contact Us
      </a>
    </div>
  );
}
