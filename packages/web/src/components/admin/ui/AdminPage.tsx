/**
 * Shared shell for admin screens: optional back link, page header, section rhythm.
 * Mirrors SettingsPage so admin reads as the same product as the rest of the app.
 */

import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminPageProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Sits under the description, e.g. status badges or inline counts. */
  meta?: ReactNode;
  back?: { to: string; label: string };
  /** Swaps the title and description for skeletons of the same size. */
  loadingTitle?: boolean;
  children: ReactNode;
}

export function AdminPage({
  title,
  description,
  actions,
  meta,
  back,
  loadingTitle,
  children,
}: AdminPageProps) {
  return (
    <div className='mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-8'>
      {back && (
        <Link
          to={back.to}
          className='text-muted-foreground hover:text-foreground mb-4 -ml-1 inline-flex h-6 items-center gap-1.5 rounded-md px-1 text-[13px] transition-colors'
        >
          <ArrowLeftIcon className='size-3.5' />
          {back.label}
        </Link>
      )}

      <header className='mb-8 flex flex-wrap items-start justify-between gap-4'>
        <div className='min-w-0'>
          {loadingTitle ?
            <Skeleton className='h-8 w-56' />
          : <h1 className='text-foreground flex min-h-8 items-center text-2xl font-semibold tracking-tight'>
              {title}
            </h1>
          }
          {description &&
            (loadingTitle ?
              <Skeleton className='mt-2 h-4 w-72' />
            : <p className='text-muted-foreground mt-1 text-sm'>{description}</p>)}
          {meta && <div className='mt-2.5 flex flex-wrap items-center gap-2'>{meta}</div>}
        </div>
        {actions && <div className='flex shrink-0 items-center gap-2'>{actions}</div>}
      </header>

      <div className='flex flex-col gap-6'>{children}</div>
    </div>
  );
}
