/** Settings navigation: a fixed rail on desktop, a scrolling strip on mobile. */

import { Link, useLocation } from '@tanstack/react-router';
import {
  UserIcon,
  ShieldIcon,
  BellIcon,
  PlugIcon,
  CreditCardIcon,
  SparklesIcon,
  ArrowLeftIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { APP_NAME, APP_VERSION } from '@/config/app';
import { NAV_GROUP_LABEL, NAV_FOOTER, navRowClass } from './navStyles';

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Account',
    items: [
      { label: 'Profile', icon: UserIcon, path: '/settings/profile' },
      { label: 'Security', icon: ShieldIcon, path: '/settings/security' },
      { label: 'Preferences', icon: BellIcon, path: '/settings/preferences' },
    ],
  },
  {
    label: 'Workspace',
    items: [{ label: 'Integrations', icon: PlugIcon, path: '/settings/integrations' }],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Billing', icon: CreditCardIcon, path: '/settings/billing' },
      { label: 'Plans', icon: SparklesIcon, path: '/settings/plans' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(group => group.items);

function useActivePath() {
  const { pathname } = useLocation();
  return pathname === '/settings' ? '/settings/profile' : pathname;
}

export function SettingsNavRail() {
  const activePath = useActivePath();

  return (
    <nav
      aria-label='Settings'
      className='border-border bg-card hidden w-60 shrink-0 flex-col border-r md:flex'
    >
      <div className='p-3'>
        <Link
          to='/dashboard'
          className='text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors'
        >
          <ArrowLeftIcon className='size-4 shrink-0' />
          Back to app
        </Link>
      </div>

      <div className='flex-1 overflow-y-auto px-3 pb-4'>
        {NAV_GROUPS.map(group => (
          <div key={group.label} className='mb-5 last:mb-0'>
            <div className={NAV_GROUP_LABEL}>{group.label}</div>
            <div className='flex flex-col gap-0.5'>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activePath === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={isActive ? 'page' : undefined}
                    className={navRowClass(isActive)}
                  >
                    <Icon
                      className={isActive ? 'text-primary size-4 shrink-0' : 'size-4 shrink-0'}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className={NAV_FOOTER}>
        {APP_NAME} {APP_VERSION}
      </div>
    </nav>
  );
}

export function SettingsNavStrip() {
  const activePath = useActivePath();

  return (
    <div className='border-border bg-card sticky top-0 z-10 border-b md:hidden'>
      <div className='flex items-center gap-1 overflow-x-auto px-3 py-2'>
        <Link
          to='/dashboard'
          aria-label='Back to app'
          className='text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-md transition-colors'
        >
          <ArrowLeftIcon className='size-4' />
        </Link>
        <div className='bg-border mx-1 h-5 w-px shrink-0' />
        {ALL_ITEMS.map(item => {
          const isActive = activePath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive ?
                  'bg-primary/10 text-primary shrink-0 rounded-md px-3 py-1.5 text-sm font-medium'
                : 'text-muted-foreground hover:text-foreground shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors'
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
