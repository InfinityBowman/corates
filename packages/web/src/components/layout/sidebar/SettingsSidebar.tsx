/**
 * SettingsSidebar - replaces the app sidebar on settings routes: a way back to
 * the app, then the Account sections (/settings/account/..., per person) and,
 * for its owner, the current workspace's sections (/<slug>/settings/...).
 */

import { Link, useLocation } from '@tanstack/react-router';
import {
  UserIcon,
  ShieldIcon,
  BellIcon,
  PlugIcon,
  CreditCardIcon,
  SparklesIcon,
  ArrowLeftIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useCurrentWorkspace } from '@/hooks/useWorkspaces';
import { workspaceSettingsPath } from '@/lib/workspacePaths';
import { NAV_GROUP_LABEL, navRowClass } from '../navStyles';

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

const ACCOUNT_GROUP: { label: string; items: NavItem[] } = {
  label: 'Account',
  items: [
    { label: 'Profile', icon: UserIcon, path: '/settings/account/profile' },
    { label: 'Security', icon: ShieldIcon, path: '/settings/account/security' },
    { label: 'Preferences', icon: BellIcon, path: '/settings/account/preferences' },
    // Google Drive is connected per person, not per workspace.
    { label: 'Integrations', icon: PlugIcon, path: '/settings/account/integrations' },
  ],
};

function workspaceGroup(slug: string): { label: string; items: NavItem[] } {
  return {
    label: 'Workspace',
    items: [
      { label: 'General', icon: SettingsIcon, path: workspaceSettingsPath(slug, 'general') },
      { label: 'Members', icon: UsersIcon, path: workspaceSettingsPath(slug, 'members') },
      { label: 'Billing', icon: CreditCardIcon, path: workspaceSettingsPath(slug, 'billing') },
      { label: 'Plans', icon: SparklesIcon, path: workspaceSettingsPath(slug, 'plans') },
    ],
  };
}

interface SettingsSidebarProps {
  onClose: () => void;
  closeLabel: string;
  closeIcon: React.ReactNode;
}

export function SettingsSidebar({ onClose, closeLabel, closeIcon }: SettingsSidebarProps) {
  const { pathname } = useLocation();
  const { workspace } = useCurrentWorkspace();
  // Workspace settings are owner-only for now.
  const groups =
    workspace?.role === 'owner' ? [ACCOUNT_GROUP, workspaceGroup(workspace.slug)] : [ACCOUNT_GROUP];

  return (
    <nav aria-label='Settings' className='flex h-full flex-col'>
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
        {groups.map(group => (
          <div key={group.label} className='mb-4 last:mb-0'>
            <div className={NAV_GROUP_LABEL}>{group.label}</div>
            <div className='flex flex-col gap-0.5'>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
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
