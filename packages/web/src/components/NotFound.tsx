/**
 * NotFound - the two 404 surfaces.
 *
 * NotFoundPage is the root notFoundComponent for public URLs: a full-height
 * page with the logo and a contact link. AppNotFound is the _app layout's
 * notFoundComponent and renders inside the app shell, so an in-app miss keeps
 * the navbar and sidebar. Both record the missed path as a Plausible event.
 */

import { useEffect } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { CompassIcon, Link2OffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';
import { clientLogger } from '@/lib/clientLogger';

const TITLE = 'Page not found - CoRATES';

function useMissedPath() {
  const pathname = useLocation({ select: location => location.pathname });

  // Path only: query strings can carry tokens and search text.
  useEffect(() => {
    clientLogger.info('client.route.not_found', { path: pathname });
  }, [pathname]);

  useEffect(() => {
    const previous = document.title;
    document.title = TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  return pathname;
}

interface NotFoundBodyProps {
  path: string;
  description: string;
  primary: { to: '/' | '/dashboard'; label: string };
  secondary: Array<{ to: '/' | '/dashboard' | '/resources' | '/contact'; label: string }>;
}

function NotFoundBody({ path, description, primary, secondary }: NotFoundBodyProps) {
  return (
    <div className='motion-safe:animate-fade-in-up w-full max-w-md text-center'>
      <div className='border-border bg-card mx-auto mb-6 flex size-12 items-center justify-center rounded-xl border shadow-sm'>
        <CompassIcon className='text-muted-foreground size-5' aria-hidden='true' />
      </div>

      <p className='text-muted-foreground mb-3 font-mono text-xs tracking-[0.2em]'>404</p>
      <h1 className='text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-3xl'>
        Page not found
      </h1>
      <p className='text-muted-foreground mt-3 text-sm text-balance sm:text-base'>{description}</p>

      <div className='mt-5 flex justify-center'>
        <code
          className='border-border bg-muted text-muted-foreground inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs'
          title={path}
        >
          <Link2OffIcon className='size-3.5 shrink-0' aria-hidden='true' />
          <span className='truncate'>{path}</span>
        </code>
      </div>

      <div className='mt-8 flex justify-center'>
        <Button asChild size='lg' className='px-4'>
          <Link to={primary.to}>{primary.label}</Link>
        </Button>
      </div>

      <nav aria-label='Other places to go' className='mt-8 flex items-center justify-center'>
        {secondary.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className='text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded px-2.5 text-sm transition-colors outline-none focus-visible:ring-3'
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function NotFoundPage() {
  const path = useMissedPath();
  const isLoggedIn = useAuthStore(selectIsLoggedIn);

  return (
    <div className='bg-background text-foreground relative flex min-h-screen flex-col'>
      <div
        aria-hidden='true'
        className='from-primary/10 pointer-events-none absolute inset-x-0 top-0 h-96 bg-radial-[ellipse_70%_100%_at_50%_0%] to-transparent to-70%'
      />

      <header className='relative flex h-16 items-center justify-between px-6'>
        <Link
          to='/'
          className='focus-visible:ring-ring/50 inline-flex items-center gap-2 rounded text-base font-semibold tracking-tight outline-none focus-visible:ring-3'
        >
          <img
            src='/logo.svg'
            alt='CoRATES Logo'
            aria-hidden='true'
            className='size-6 rounded-sm'
            width='24'
            height='24'
          />
          CoRATES
        </Link>
        <Link
          to='/contact'
          className='text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded text-sm transition-colors outline-none focus-visible:ring-3'
        >
          Contact support
        </Link>
      </header>

      <main className='relative flex flex-1 items-center justify-center px-6 pb-24'>
        <NotFoundBody
          path={path}
          description='The link may be out of date, or the page has moved.'
          primary={
            isLoggedIn ?
              { to: '/dashboard', label: 'Go to dashboard' }
            : { to: '/', label: 'Back to home' }
          }
          secondary={[
            isLoggedIn ? { to: '/', label: 'Home' } : { to: '/dashboard', label: 'Dashboard' },
            { to: '/resources', label: 'Resources' },
            { to: '/contact', label: 'Contact' },
          ]}
        />
      </main>
    </div>
  );
}

export function AppNotFound() {
  const path = useMissedPath();

  return (
    <div className='flex flex-1 items-center justify-center p-8'>
      <NotFoundBody
        path={path}
        description='It may have been deleted, or the link may be out of date.'
        primary={{ to: '/dashboard', label: 'Back to dashboard' }}
        secondary={[
          { to: '/resources', label: 'Resources' },
          { to: '/contact', label: 'Contact' },
        ]}
      />
    </div>
  );
}
