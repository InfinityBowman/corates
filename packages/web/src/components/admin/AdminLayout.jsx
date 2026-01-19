/**
 * Admin Layout component
 * Provides shared navbar navigation for all admin routes
 */

import { Show, For, onMount } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';
import {
  FiShield,
  FiHome,
  FiDatabase,
  FiFilter,
  FiAlertTriangle,
  FiLoader,
  FiAlertCircle,
  FiServer,
  FiFolder,
  FiCreditCard,
} from 'solid-icons/fi';
import { A } from '@solidjs/router';
import { isAdmin, isAdminChecked, checkAdminStatus } from '@/stores/adminStore.js';
import { DashboardBody } from './ui/index.js';
import { SectionErrorBoundary } from '@components/ErrorBoundary.jsx';

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: FiShield },
  { path: '/admin/orgs', label: 'Organizations', icon: FiHome },
  { path: '/admin/projects', label: 'Projects', icon: FiFolder },
  { path: '/admin/storage', label: 'Storage', icon: FiDatabase },
  { path: '/admin/database', label: 'Database', icon: FiServer },
  { path: '/admin/billing/ledger', label: 'Event Ledger', icon: FiFilter },
  { path: '/admin/billing/stuck-states', label: 'Stuck States', icon: FiAlertTriangle },
  { path: '/admin/billing/stripe-tools', label: 'Stripe Tools', icon: FiCreditCard },
];

export default function AdminLayout(props) {
  const navigate = useNavigate();
  const location = useLocation();

  onMount(async () => {
    await checkAdminStatus();
    if (!isAdmin()) {
      navigate('/dashboard');
    }
  });

  const isActive = path => {
    const currentPath = location.pathname;
    if (path === '/admin') {
      return currentPath === '/admin' || currentPath === '/admin/';
    }
    return currentPath.startsWith(path);
  };

  return (
    <Show
      when={isAdminChecked()}
      fallback={
        <div class='flex min-h-100 items-center justify-center'>
          <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
        </div>
      }
    >
      <Show
        when={isAdmin()}
        fallback={
          <div class='text-muted-foreground flex min-h-100 flex-col items-center justify-center'>
            <FiAlertCircle class='mb-4 h-12 w-12' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        <div class='bg-muted mx-auto min-h-full'>
          {/* Navbar */}
          <div class='border-border bg-card border-b'>
            <div class='px-6'>
              <nav class='flex space-x-1' role='navigation' aria-label='Admin navigation'>
                <For each={navItems}>
                  {item => {
                    const Icon = item.icon;
                    const active = () => isActive(item.path);
                    return (
                      <A
                        href={item.path}
                        class={`flex items-center space-x-2 rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                          active() ?
                            'border-blue-600 bg-blue-50 text-blue-700'
                          : 'text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground border-transparent'
                        }`}
                      >
                        <Icon class='h-4 w-4' />
                        <span>{item.label}</span>
                      </A>
                    );
                  }}
                </For>
              </nav>
            </div>
          </div>

          {/* Page Content */}
          <DashboardBody>
            <SectionErrorBoundary name='Admin'>{props.children}</SectionErrorBoundary>
          </DashboardBody>
        </div>
      </Show>
    </Show>
  );
}
