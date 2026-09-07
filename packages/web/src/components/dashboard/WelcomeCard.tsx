/**
 * WelcomeCard - greeting with checklist quick starts.
 * Shown on Home for logged-in users.
 */

import type { AuthUser } from '@/stores/authStore';
import { QuickActions } from './QuickActions';

interface WelcomeCardProps {
  user: AuthUser;
  style?: React.CSSProperties;
}

export function WelcomeCard({ user, style }: WelcomeCardProps) {
  const firstName = user.givenName || user.name || '';

  return (
    <section className='border-border bg-card rounded-lg border p-5' style={style}>
      <h2 className='text-foreground text-lg font-semibold tracking-tight'>
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
