/**
 * ContactPrompt - Prompts users to contact for early access when they cannot create projects
 */

interface RestrictionCopyArgs {
  restrictionType: 'entitlement' | 'quota' | null;
  projectCount: number;
  quotaLimit?: number | null;
}

export function getRestrictionCopy({
  restrictionType,
  projectCount,
  quotaLimit,
}: RestrictionCopyArgs) {
  const title =
    restrictionType === 'entitlement' ? 'Ready to collaborate?' : 'Project limit reached';

  const message =
    restrictionType === 'entitlement' ?
      'Projects let you and your team appraise the same study independently, then reconcile where you disagree. Start a 14-day free trial to create your first project. No credit card required.'
    : `Your plan covers ${quotaLimit === null || quotaLimit === -1 ? 'unlimited' : quotaLimit} projects and you are using ${projectCount}. Upgrade your plan to create more.`;

  return { title, message };
}

export function ContactPrompt({ restrictionType, projectCount, quotaLimit }: RestrictionCopyArgs) {
  const { title, message } = getRestrictionCopy({ restrictionType, projectCount, quotaLimit });

  return (
    <div className='bg-info-bg border-info-border flex items-center justify-between rounded-lg border p-4'>
      <div>
        <p className='text-card-foreground font-medium'>{title}</p>
        <p className='text-muted-foreground text-sm'>{message}</p>
      </div>
      <a
        href='/pricing'
        className='bg-primary hover:bg-primary/90 ml-4 rounded-lg px-4 py-2 font-medium whitespace-nowrap text-white transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none'
      >
        View plans
      </a>
    </div>
  );
}
