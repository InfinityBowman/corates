/**
 * AdminSidebar - replaces the app sidebar while on /admin routes:
 * a way back to the app, then the admin sections.
 */

import { Link, useLocation } from '@tanstack/react-router';
import {
  LayoutDashboardIcon,
  BuildingIcon,
  FolderIcon,
  HardDriveIcon,
  ServerIcon,
  ReceiptTextIcon,
  AlertTriangleIcon,
  CreditCardIcon,
  ArrowLeftIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { NAV_GROUP_LABEL, navRowClass } from '../navStyles';

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboardIcon, path: '/admin' }],
  },
  {
    label: 'Directory',
    items: [
      { label: 'Organizations', icon: BuildingIcon, path: '/admin/orgs' },
      { label: 'Projects', icon: FolderIcon, path: '/admin/projects' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { label: 'Storage', icon: HardDriveIcon, path: '/admin/storage' },
      { label: 'Database', icon: ServerIcon, path: '/admin/database' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Event Ledger', icon: ReceiptTextIcon, path: '/admin/billing/ledger' },
      { label: 'Stuck States', icon: AlertTriangleIcon, path: '/admin/billing/stuck-states' },
      { label: 'Stripe Tools', icon: CreditCardIcon, path: '/admin/billing/stripe-tools' },
    ],
  },
];

// User detail pages are reached from the dashboard, so they keep it highlighted.
function isItemActive(pathname: string, path: string): boolean {
  if (path === '/admin') {
    return pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/users');
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

interface AdminSidebarProps {
  onClose: () => void;
  closeLabel: string;
  closeIcon: React.ReactNode;
}

export function AdminSidebar({ onClose, closeLabel, closeIcon }: AdminSidebarProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label='Admin' className='flex h-full flex-col'>
      <div className='flex shrink-0 items-center gap-1 px-2 pt-2 pb-1'>
        <Link
          to='/dashboard'
          className='text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-sm font-medium transition-colors'
        >
          <ArrowLeftIcon className='size-4 shrink-0' />
          Back to app
        </Link>
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={onClose}
              className='text-muted-foreground/70 hover:text-muted-foreground shrink-0'
              aria-label={closeLabel}
            >
              {closeIcon}
            </Button>
          </TooltipTrigger>
          <TooltipContent side='right'>{closeLabel}</TooltipContent>
        </Tooltip>
      </div>

      <div className='flex-1 overflow-y-auto px-2 pb-4'>
        {NAV_GROUPS.map(group => (
          <div key={group.label} className='mb-4 last:mb-0'>
            <div className={NAV_GROUP_LABEL}>{group.label}</div>
            <div className='flex flex-col gap-0.5'>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = isItemActive(pathname, item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={isActive ? 'page' : undefined}
                    className={navRowClass(isActive)}
                  >
                    <Icon className='size-4 shrink-0' />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
