/**
 * PasswordInput - text input with a show/hide visibility toggle.
 *
 * Built on the shadcn `Input` primitive. Accepts all native input props.
 *
 * @example
 * <PasswordInput
 *   autoComplete='current-password'
 *   value={password}
 *   onChange={(e) => setPassword(e.target.value)}
 *   placeholder='Password'
 * />
 */

import * as React from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function PasswordInput({ className, disabled, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className='relative flex items-center'>
      <Input
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={cn('h-auto py-2 pr-10 text-sm', className)}
        {...props}
      />
      <button
        type='button'
        onClick={() => setVisible(v => !v)}
        disabled={disabled}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className={cn(
          'text-muted-foreground/70 hover:text-muted-foreground absolute right-3 flex items-center transition-colors',
          'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {visible ?
          <EyeIcon className='h-4 w-4' />
        : <EyeOffIcon className='h-4 w-4' />}
      </button>
    </div>
  );
}

export { PasswordInput };
