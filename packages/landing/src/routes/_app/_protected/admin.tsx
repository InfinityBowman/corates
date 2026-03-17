/**
 * Admin Layout route
 * Provides shared tab navbar navigation for all admin routes.
 * Checks admin status on mount and redirects non-admins to /dashboard.
 */

import { useEffect } from 'react';
import { createFileRoute, Outlet, Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  ShieldIcon,
  HomeIcon,
  DatabaseIcon,
  FilterIcon,
  AlertTriangleIcon,
  LoaderIcon,
  AlertCircleIcon,
  ServerIcon,
  FolderIcon,
  CreditCardIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAdminStore } from '@/stores/adminStore';
import { DashboardBody } from '@/components/admin/ui';
import { SectionErrorBoundary } from '@/components/project/SectionErrorBoundary';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: ShieldIcon },
  { path: '/admin/orgs', label: 'Organizations', icon: HomeIcon },
  { path: '/admin/projects', label: 'Projects', icon: FolderIcon },
  { path: '/admin/storage', label: 'Storage', icon: DatabaseIcon },
  { path: '/admin/database', label: 'Database', icon: ServerIcon },
  { path: '/admin/billing/ledger', label: 'Event Ledger', icon: FilterIcon },
  { path: '/admin/billing/stuck-states', label: 'Stuck States', icon: AlertTriangleIcon },
  { path: '/admin/billing/stripe-tools', label: 'Stripe Tools', icon: CreditCardIcon },
];

// Route path will be registered once the route tree is regenerated
export const Route = createFileRoute('/_app/_protected/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isAdminChecked, checkAdminStatus } = useAdminStore();

  useEffect(() => {
    checkAdminStatus().then(admin => {
      if (!admin) {
        navigate({ to: '/dashboard' });
      }
    });
  }, [checkAdminStatus, navigate]);

  const isActive = (path: string) => {
    const currentPath = location.pathname;
    if (path === '/admin') {
      return currentPath === '/admin' || currentPath === '/admin/';
    }
    return currentPath.startsWith(path);
  };

  if (!isAdminChecked) {
    return (
      <div className='flex min-h-100 items-center justify-center'>
        <LoaderIcon className='h-8 w-8 animate-spin text-blue-600' />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className='text-muted-foreground flex min-h-100 flex-col items-center justify-center'>
        <AlertCircleIcon className='mb-4 h-12 w-12' />
        <p className='text-lg font-medium'>Access Denied</p>
        <p className='text-sm'>You do not have admin privileges.</p>
      </div>
    );
  }

  return (
    <div className='bg-muted mx-auto min-h-full'>
      {/* Navbar */}
      <div className='border-border bg-card border-b'>
        <div className='px-6'>
          <nav className='flex space-x-1' role='navigation' aria-label='Admin navigation'>
            {navItems.map(item => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path as string}
                  className={`flex items-center space-x-2 rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    active ?
                      'border-blue-600 bg-blue-50 text-blue-700'
                    : 'text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground border-transparent'
                  }`}
                >
                  <Icon className='h-4 w-4' />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <DashboardBody>
        <SectionErrorBoundary name='Admin'>
          <Outlet />
        </SectionErrorBoundary>
      </DashboardBody>
    </div>
  );
}
