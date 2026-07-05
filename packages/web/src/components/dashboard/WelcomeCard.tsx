/**
 * WelcomeCard - First-time user onboarding with quick actions
 *
 * Shown on the dashboard for logged-in users who haven't dismissed it.
 * Replaces the standard DashboardHeader greeting until dismissed.
 */

import { Link } from '@tanstack/react-router';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/stores/authStore';
import { useAnimation } from './useInitialAnimation';
import { QuickActions } from './QuickActions';

interface WelcomeCardProps {
  user: AuthUser;
  onDismiss: () => void;
}

export function WelcomeCard({ user, onDismiss }: WelcomeCardProps) {
  const animation = useAnimation();
  const firstName = user.givenName || user.name || '';

  return (
    <section className='mb-8' style={animation.fadeUp(0)}>
      <div className='border-border bg-card relative rounded-2xl border p-6 sm:p-8'>
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={onDismiss}
          className='text-muted-foreground absolute top-4 right-4'
          aria-label='Dismiss welcome card'
        >
          <XIcon className='size-5' />
        </Button>

        <div className='mb-6 pr-8'>
          <h1 className='text-foreground text-2xl font-semibold tracking-tight sm:text-3xl'>
            Welcome{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className='text-muted-foreground mt-2 max-w-xl'>
            Start appraising studies right away. Pick a tool below to create your first appraisal.
          </p>
        </div>

        <QuickActions />

        <div className='border-border mt-6 border-t pt-4'>
          <p className='text-muted-foreground text-sm'>
            <span className='text-foreground font-medium'>Local appraisals</span> are saved on this
            device and always free. <span className='text-foreground font-medium'>Projects</span>{' '}
            let teams appraise independently and resolve disagreements together.{' '}
            <Link to='/pricing' className='text-primary hover:text-primary/80'>
              Explore plans
            </Link>{' '}
            when you&#39;re ready to collaborate.
          </p>
        </div>
      </div>
    </section>
  );
}
