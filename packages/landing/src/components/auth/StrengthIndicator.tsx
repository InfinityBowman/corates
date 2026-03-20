/**
 * Password strength indicator with live requirement checking
 */

import { useMemo, useEffect } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';

const requirementsList = [
  {
    label: 'At least 8 characters',
    test: (pw: string) => pw.length >= 8,
    error: 'at least 8 characters',
  },
  {
    label: 'Uppercase letter (A-Z)',
    test: (pw: string) => /[A-Z]/.test(pw),
    error: 'an uppercase letter',
  },
  {
    label: 'Lowercase letter (a-z)',
    test: (pw: string) => /[a-z]/.test(pw),
    error: 'a lowercase letter',
  },
  { label: 'Number (0-9)', test: (pw: string) => /\d/.test(pw), error: 'a number' },
  {
    label: 'Special character (e.g. !?<>@#$%)',
    test: (pw: string) => /[^A-Za-z0-9]/.test(pw),
    error: 'a special character',
  },
];

/* eslint-disable no-unused-vars */
interface StrengthIndicatorProps {
  password: string;
  onUnmet?: (errors: string[]) => void;
}
/* eslint-enable no-unused-vars */

export function StrengthIndicator({ password, onUnmet }: StrengthIndicatorProps) {
  const strength = useMemo(() => {
    if (!password) {
      return {
        met: [] as string[],
        errors: requirementsList.map(r => r.error),
      };
    }
    const met = requirementsList.filter(r => r.test(password)).map(r => r.label);
    const errors = requirementsList.filter(r => !r.test(password)).map(r => r.error);
    return { met, errors };
  }, [password]);

  useEffect(() => {
    onUnmet?.(strength.errors);
  }, [strength.errors, onUnmet]);

  return (
    <div className='mt-2 w-full'>
      <ul
        className='text-secondary-foreground space-y-0.5 text-xs sm:space-y-1'
        id='password-requirements'
        aria-live='polite'
      >
        {requirementsList.map(req => {
          const met = strength.met.includes(req.label);
          return (
            <li key={req.label} className='flex items-center gap-2'>
              <span
                className={`ml-1 flex h-4 w-4 items-center justify-center rounded-full ${
                  met ?
                    'border border-green-500 bg-white text-green-500'
                  : 'border border-red-600 text-red-600'
                }`}
                aria-hidden='true'
              >
                {met ?
                  <CheckIcon className='h-3 w-3' />
                : <XIcon className='h-3 w-3' />}
              </span>
              <span className={met ? 'text-green-500' : 'text-red-600'}>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
