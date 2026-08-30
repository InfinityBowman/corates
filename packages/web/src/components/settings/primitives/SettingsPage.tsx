/** Shared shell for settings screens: page header plus section rhythm. */

import type { ReactNode } from 'react';

interface SettingsPageProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function SettingsPage({ title, description, action, children }: SettingsPageProps) {
  return (
    <div className='w-full px-5 py-8 sm:px-8'>
      <header className='mb-8 flex flex-wrap items-start justify-between gap-4'>
        <div className='min-w-0'>
          <h1 className='text-foreground text-2xl font-semibold tracking-tight'>{title}</h1>
          {description && <p className='text-muted-foreground mt-1 text-sm'>{description}</p>}
        </div>
        {action}
      </header>

      <div className='flex flex-col gap-8'>{children}</div>
    </div>
  );
}
