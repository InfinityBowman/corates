/**
 * Shows a hint about the user's last login method on the sign-in page
 */

import { useState } from 'react';
import { LockIcon, MailIcon } from 'lucide-react';
import { getLastLoginMethod, LOGIN_METHOD_LABELS, LOGIN_METHODS } from '@/lib/lastLoginMethod';

function getIcon(method: string) {
  switch (method) {
    case LOGIN_METHODS.GOOGLE:
      return <img src='/logos/google.svg' alt='' className='size-4' aria-hidden='true' />;
    case LOGIN_METHODS.ORCID:
      return <img src='/logos/orcid.svg' alt='' className='size-4' aria-hidden='true' />;
    case LOGIN_METHODS.MAGIC_LINK:
      return <MailIcon className='size-4' />;
    default:
      return <LockIcon className='size-4' />;
  }
}

export function LastLoginHint() {
  const [lastMethod] = useState<string | null>(() => {
    const method = getLastLoginMethod();
    return method && LOGIN_METHOD_LABELS[method] ? method : null;
  });

  if (!lastMethod) return null;

  return (
    <div className='bg-muted text-muted-foreground flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs'>
      <span className='text-muted-foreground/70'>{getIcon(lastMethod)}</span>
      <span>You last signed in with {LOGIN_METHOD_LABELS[lastMethod]}</span>
    </div>
  );
}
