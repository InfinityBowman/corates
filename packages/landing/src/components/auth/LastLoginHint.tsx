/**
 * Shows a hint about the user's last login method on the sign-in page
 */

import { useState } from 'react';
import { FiLock, FiMail } from 'react-icons/fi';
import { AiOutlineGoogle } from 'react-icons/ai';
import { FaOrcid } from 'react-icons/fa6';
import { getLastLoginMethod, LOGIN_METHOD_LABELS, LOGIN_METHODS } from '@/lib/lastLoginMethod.js';

function getIcon(method: string) {
  switch (method) {
    case LOGIN_METHODS.GOOGLE:
      return <AiOutlineGoogle className='h-4 w-4' />;
    case LOGIN_METHODS.ORCID:
      return <FaOrcid className='h-4 w-4' />;
    case LOGIN_METHODS.MAGIC_LINK:
      return <FiMail className='h-4 w-4' />;
    default:
      return <FiLock className='h-4 w-4' />;
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
