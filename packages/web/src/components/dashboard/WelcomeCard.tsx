/**
 * WelcomeCard - first-run greeting with checklist quick starts.
 * Shown on Home for logged-in users until dismissed.
 */

import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/stores/authStore';
import { QuickActions } from './QuickActions';

interface WelcomeCardProps {
  user: AuthUser;
  onDismiss: () => void;
  style?: React.CSSProperties;
}

export function WelcomeCard({ user, onDismiss, style }: WelcomeCardProps) {
  const firstName = user.givenName || user.name || '';

  return (
    <section className='border-border bg-card relative rounded-lg border p-5' style={style}>
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={onDismiss}
        className='text-muted-foreground absolute top-3 right-3'
        aria-label='Dismiss welcome card'
      >
        <XIcon className='size-4' />
      </Button>

      <h2 className='text-foreground pr-8 text-lg font-semibold tracking-tight'>
        Welcome{firstName ? `, ${firstName}` : ''}
      </h2>
      <p className='text-muted-foreground mt-1 mb-4 text-sm'>
        Pick a checklist and open the PDF beside it. Local appraisals stay on this device and are
        free.
      </p>

      <QuickActions />
    </section>
  );
}
