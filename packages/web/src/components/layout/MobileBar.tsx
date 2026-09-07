/**
 * MobileBar - the only top chrome on small screens: a sidebar toggle and the
 * app name. Desktop has no top bar; everything lives in the sidebar.
 */

import { Link } from '@tanstack/react-router';
import { MenuIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/config/app';

interface MobileBarProps {
  open: boolean;
  onToggle: () => void;
}

export function MobileBar({ open, onToggle }: MobileBarProps) {
  return (
    <div className='border-border bg-card flex h-11 shrink-0 items-center gap-1 border-b px-2 md:hidden'>
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={onToggle}
        aria-label={open ? 'Close sidebar' : 'Open sidebar'}
      >
        {open ?
          <XIcon className='size-4' />
        : <MenuIcon className='size-4' />}
      </Button>
      <Link to='/dashboard' className='flex items-center gap-2 px-1 text-sm font-semibold'>
        <img src='/logo.svg' alt='' aria-hidden='true' className='size-5 rounded-sm' />
        {APP_NAME}
      </Link>
    </div>
  );
}
