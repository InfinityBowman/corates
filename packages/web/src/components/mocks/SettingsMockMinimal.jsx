/**
 * Settings Mock - Minimal Swiss Style
 *
 * Design Direction: Clean, typographic, understated elegance.
 * Uses strong hierarchy, generous whitespace, and precise alignment.
 * Inspired by Swiss design principles and Dieter Rams' aesthetic.
 */

import { For, Show, createSignal } from 'solid-js';
import {
  FiUser,
  FiCreditCard,
  FiShield,
  FiBell,
  FiLink,
  FiMonitor,
  FiCheck,
  FiArrowRight,
  FiExternalLink,
  FiChevronRight,
  FiCloud,
  FiKey,
  FiSmartphone,
  FiMail,
  FiLogOut,
} from 'solid-icons/fi';

// Mock data
const mockUser = {
  name: 'Dr. Sarah Chen',
  email: 'sarah.chen@university.edu',
  institution: 'Stanford University',
  joined: 'December 2024',
};

const mockPlan = {
  name: 'Professional',
  price: 29,
  interval: 'month',
  features: ['15 Projects', '25 Collaborators', '10 GB Storage', 'Priority Support'],
};

const navItems = [
  { id: 'account', label: 'Account', icon: FiUser },
  { id: 'billing', label: 'Billing', icon: FiCreditCard },
  { id: 'security', label: 'Security', icon: FiShield },
  { id: 'notifications', label: 'Notifications', icon: FiBell },
  { id: 'integrations', label: 'Integrations', icon: FiLink },
];

const mockNotificationSettings = [
  {
    id: 'email',
    title: 'Email Notifications',
    description: 'Receive important updates via email',
    enabled: true,
  },
  {
    id: 'projects',
    title: 'Project Updates',
    description: 'When collaborators make changes',
    enabled: true,
  },
  {
    id: 'mentions',
    title: 'Mentions',
    description: 'When someone mentions you in a comment',
    enabled: false,
  },
  {
    id: 'marketing',
    title: 'Product Updates',
    description: 'News about new features and improvements',
    enabled: false,
  },
];

const mockSessions = [
  { id: 1, device: 'MacBook Pro', browser: 'Safari', location: 'San Francisco', current: true },
  { id: 2, device: 'iPhone 15', browser: 'Safari', location: 'San Francisco', current: false },
  { id: 3, device: 'Windows PC', browser: 'Chrome', location: 'New York', current: false },
];

// Minimal toggle component
function MinimalToggle(props) {
  return (
    <button
      onClick={() => props.onChange?.(!props.checked)}
      class={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
        props.checked ? 'bg-black' : 'bg-neutral-200'
      }`}
    >
      <div
        class={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          props.checked ? 'left-0.5 translate-x-5.5' : 'left-0.5'
        }`}
        style={{ transform: props.checked ? 'translateX(22px)' : 'translateX(0)' }}
      />
    </button>
  );
}

// Section component for consistent styling
function Section(props) {
  return (
    <section class='border-t border-neutral-100 py-10 first:border-t-0 first:pt-0'>
      <Show when={props.title}>
        <h2 class='mb-1 text-xs font-medium tracking-widest text-neutral-400 uppercase'>
          {props.title}
        </h2>
      </Show>
      <Show when={props.subtitle}>
        <p class='mb-8 text-sm text-neutral-500'>{props.subtitle}</p>
      </Show>
      {props.children}
    </section>
  );
}

// Row component for settings items
function SettingRow(props) {
  return (
    <div class='group flex items-center justify-between border-b border-neutral-100 py-5 last:border-b-0'>
      <div class='flex-1'>
        <h3 class='font-medium text-neutral-900'>{props.title}</h3>
        <Show when={props.description}>
          <p class='mt-0.5 text-sm text-neutral-500'>{props.description}</p>
        </Show>
      </div>
      <div class='ml-4'>{props.children}</div>
    </div>
  );
}

export default function SettingsMockMinimal() {
  const [activeNav, setActiveNav] = createSignal('account');
  const [notifications, setNotifications] = createSignal(
    mockNotificationSettings.reduce((acc, n) => ({ ...acc, [n.id]: n.enabled }), {}),
  );

  const toggleNotification = id => {
    setNotifications(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div class='min-h-screen bg-white'>
      {/* Top Bar */}
      <header class='border-b border-neutral-100'>
        <div class='mx-auto flex max-w-6xl items-center justify-between px-8 py-4'>
          <div class='flex items-center gap-6'>
            <span class='text-xl font-semibold tracking-tight text-neutral-900'>CoRATES</span>
            <span class='text-sm text-neutral-400'>/</span>
            <span class='text-sm text-neutral-600'>Settings</span>
          </div>
          <div class='flex items-center gap-4'>
            <span class='text-sm text-neutral-600'>{mockUser.email}</span>
            <div class='h-8 w-8 rounded-full bg-neutral-900 text-center text-xs leading-8 font-medium text-white'>
              SC
            </div>
          </div>
        </div>
      </header>

      <div class='mx-auto flex max-w-6xl'>
        {/* Sidebar Navigation */}
        <nav class='w-56 shrink-0 border-r border-neutral-100 py-8 pr-8'>
          <ul class='space-y-1'>
            <For each={navItems}>
              {item => {
                const Icon = item.icon;
                return (
                  <li>
                    <button
                      onClick={() => setActiveNav(item.id)}
                      class={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                        activeNav() === item.id ?
                          'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <Icon class='h-4 w-4' />
                      {item.label}
                    </button>
                  </li>
                );
              }}
            </For>
          </ul>

          {/* Bottom actions */}
          <div class='mt-8 border-t border-neutral-100 pt-8'>
            <button class='flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50'>
              <FiLogOut class='h-4 w-4' />
              Sign Out
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main class='flex-1 px-12 py-8'>
          {/* Account Section */}
          <Show when={activeNav() === 'account'}>
            <div class='mb-8'>
              <h1 class='text-2xl font-semibold text-neutral-900'>Account</h1>
              <p class='mt-1 text-neutral-500'>Manage your personal information</p>
            </div>

            <Section>
              <div class='flex items-start gap-8'>
                {/* Avatar */}
                <div class='relative'>
                  <div class='flex h-24 w-24 items-center justify-center rounded-full bg-neutral-900 text-2xl font-medium text-white'>
                    SC
                  </div>
                  <button class='absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200'>
                    <FiUser class='h-4 w-4' />
                  </button>
                </div>

                {/* Info */}
                <div class='flex-1 space-y-6'>
                  <div class='grid grid-cols-2 gap-6'>
                    <div>
                      <label class='mb-2 block text-xs font-medium tracking-wide text-neutral-400 uppercase'>
                        Full Name
                      </label>
                      <input
                        type='text'
                        value={mockUser.name}
                        class='w-full border-b border-neutral-200 bg-transparent pb-2 text-neutral-900 focus:border-neutral-900 focus:outline-none'
                      />
                    </div>
                    <div>
                      <label class='mb-2 block text-xs font-medium tracking-wide text-neutral-400 uppercase'>
                        Email
                      </label>
                      <input
                        type='email'
                        value={mockUser.email}
                        class='w-full border-b border-neutral-200 bg-transparent pb-2 text-neutral-900 focus:border-neutral-900 focus:outline-none'
                      />
                    </div>
                    <div>
                      <label class='mb-2 block text-xs font-medium tracking-wide text-neutral-400 uppercase'>
                        Institution
                      </label>
                      <input
                        type='text'
                        value={mockUser.institution}
                        class='w-full border-b border-neutral-200 bg-transparent pb-2 text-neutral-900 focus:border-neutral-900 focus:outline-none'
                      />
                    </div>
                    <div>
                      <label class='mb-2 block text-xs font-medium tracking-wide text-neutral-400 uppercase'>
                        Member Since
                      </label>
                      <p class='border-b border-transparent pb-2 text-neutral-500'>
                        {mockUser.joined}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section title='Danger Zone'>
              <div class='rounded-lg border border-red-200 bg-red-50/50 p-6'>
                <div class='flex items-center justify-between'>
                  <div>
                    <h3 class='font-medium text-red-900'>Delete Account</h3>
                    <p class='text-sm text-red-600'>
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                  <button class='rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50'>
                    Delete Account
                  </button>
                </div>
              </div>
            </Section>
          </Show>

          {/* Billing Section */}
          <Show when={activeNav() === 'billing'}>
            <div class='mb-8'>
              <h1 class='text-2xl font-semibold text-neutral-900'>Billing</h1>
              <p class='mt-1 text-neutral-500'>Manage your subscription and payments</p>
            </div>

            <Section>
              {/* Current Plan */}
              <div class='flex items-stretch gap-6'>
                <div class='flex-1 rounded-2xl border border-neutral-200 p-8'>
                  <div class='mb-6 flex items-start justify-between'>
                    <div>
                      <p class='text-xs font-medium tracking-widest text-neutral-400 uppercase'>
                        Current Plan
                      </p>
                      <h2 class='mt-1 text-3xl font-semibold text-neutral-900'>{mockPlan.name}</h2>
                    </div>
                    <span class='rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700'>
                      Active
                    </span>
                  </div>

                  <div class='mb-6'>
                    <span class='text-4xl font-bold text-neutral-900'>${mockPlan.price}</span>
                    <span class='text-neutral-500'>/{mockPlan.interval}</span>
                  </div>

                  <ul class='space-y-3'>
                    <For each={mockPlan.features}>
                      {feature => (
                        <li class='flex items-center gap-3 text-sm text-neutral-600'>
                          <FiCheck class='h-4 w-4 text-emerald-600' />
                          {feature}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>

                {/* Quick Actions */}
                <div class='flex w-64 flex-col gap-3'>
                  <button class='flex items-center justify-between rounded-xl bg-neutral-900 px-5 py-4 text-left text-white transition-colors hover:bg-neutral-800'>
                    <span class='font-medium'>Change Plan</span>
                    <FiArrowRight class='h-4 w-4' />
                  </button>
                  <button class='flex items-center justify-between rounded-xl border border-neutral-200 px-5 py-4 text-left text-neutral-900 transition-colors hover:bg-neutral-50'>
                    <span class='font-medium'>Payment Method</span>
                    <FiCreditCard class='h-4 w-4 text-neutral-400' />
                  </button>
                  <button class='flex items-center justify-between rounded-xl border border-neutral-200 px-5 py-4 text-left text-neutral-900 transition-colors hover:bg-neutral-50'>
                    <span class='font-medium'>Billing History</span>
                    <FiExternalLink class='h-4 w-4 text-neutral-400' />
                  </button>
                </div>
              </div>
            </Section>

            <Section title='Usage This Period'>
              <div class='grid grid-cols-3 gap-6'>
                {[
                  { label: 'Projects', used: 8, limit: 15 },
                  { label: 'Collaborators', used: 12, limit: 25 },
                  { label: 'Storage', used: 2.4, limit: 10, suffix: 'GB' },
                ].map(stat => (
                  <div class='rounded-xl border border-neutral-100 bg-neutral-50/50 p-6'>
                    <p class='text-xs font-medium tracking-widest text-neutral-400 uppercase'>
                      {stat.label}
                    </p>
                    <p class='mt-2 text-3xl font-bold text-neutral-900'>
                      {stat.used}
                      <span class='text-lg font-normal text-neutral-400'>
                        /{stat.limit}
                        {stat.suffix || ''}
                      </span>
                    </p>
                    <div class='mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200'>
                      <div
                        class='h-full rounded-full bg-neutral-900 transition-all'
                        style={{ width: `${(stat.used / stat.limit) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </Show>

          {/* Security Section */}
          <Show when={activeNav() === 'security'}>
            <div class='mb-8'>
              <h1 class='text-2xl font-semibold text-neutral-900'>Security</h1>
              <p class='mt-1 text-neutral-500'>Protect your account</p>
            </div>

            <Section title='Authentication'>
              <SettingRow title='Password' description='Last changed 30 days ago'>
                <button class='rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-200'>
                  Change
                </button>
              </SettingRow>

              <SettingRow
                title='Two-Factor Authentication'
                description='Add an extra layer of security to your account'
              >
                <button class='rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800'>
                  Enable
                </button>
              </SettingRow>

              <SettingRow
                title='Recovery Codes'
                description='Generate backup codes for account recovery'
              >
                <button class='rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-200'>
                  Generate
                </button>
              </SettingRow>
            </Section>

            <Section title='Active Sessions' subtitle='Devices currently logged into your account'>
              <div class='space-y-3'>
                <For each={mockSessions}>
                  {session => (
                    <div class='flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/30 p-5'>
                      <div class='flex items-center gap-4'>
                        <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-white text-neutral-600'>
                          <FiMonitor class='h-5 w-5' />
                        </div>
                        <div>
                          <p class='font-medium text-neutral-900'>
                            {session.device}
                            <Show when={session.current}>
                              <span class='ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'>
                                Current
                              </span>
                            </Show>
                          </p>
                          <p class='text-sm text-neutral-500'>
                            {session.browser} - {session.location}
                          </p>
                        </div>
                      </div>
                      <Show when={!session.current}>
                        <button class='text-sm font-medium text-red-600 hover:text-red-700'>
                          Revoke
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Section>
          </Show>

          {/* Notifications Section */}
          <Show when={activeNav() === 'notifications'}>
            <div class='mb-8'>
              <h1 class='text-2xl font-semibold text-neutral-900'>Notifications</h1>
              <p class='mt-1 text-neutral-500'>Control how you receive updates</p>
            </div>

            <Section title='Email Preferences'>
              <For each={mockNotificationSettings}>
                {setting => (
                  <SettingRow title={setting.title} description={setting.description}>
                    <MinimalToggle
                      checked={notifications()[setting.id]}
                      onChange={() => toggleNotification(setting.id)}
                    />
                  </SettingRow>
                )}
              </For>
            </Section>
          </Show>

          {/* Integrations Section */}
          <Show when={activeNav() === 'integrations'}>
            <div class='mb-8'>
              <h1 class='text-2xl font-semibold text-neutral-900'>Integrations</h1>
              <p class='mt-1 text-neutral-500'>Connect third-party services</p>
            </div>

            <Section>
              {[
                {
                  name: 'Google Drive',
                  description: 'Import PDFs directly from your Drive',
                  icon: FiCloud,
                  connected: true,
                },
                {
                  name: 'Zotero',
                  description: 'Sync your reference library',
                  icon: FiLink,
                  connected: false,
                },
                {
                  name: 'Mendeley',
                  description: 'Import references and annotations',
                  icon: FiLink,
                  connected: false,
                },
              ].map(integration => {
                const Icon = integration.icon;
                return (
                  <div class='flex items-center justify-between border-b border-neutral-100 py-6 last:border-b-0'>
                    <div class='flex items-center gap-4'>
                      <div class='flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600'>
                        <Icon class='h-6 w-6' />
                      </div>
                      <div>
                        <h3 class='font-medium text-neutral-900'>{integration.name}</h3>
                        <p class='text-sm text-neutral-500'>{integration.description}</p>
                      </div>
                    </div>
                    <Show
                      when={integration.connected}
                      fallback={
                        <button class='rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800'>
                          Connect
                        </button>
                      }
                    >
                      <div class='flex items-center gap-3'>
                        <span class='flex items-center gap-2 text-sm text-emerald-600'>
                          <FiCheck class='h-4 w-4' />
                          Connected
                        </span>
                        <button class='rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50'>
                          Disconnect
                        </button>
                      </div>
                    </Show>
                  </div>
                );
              })}
            </Section>
          </Show>

          {/* Save Button */}
          <div class='mt-10 flex justify-end border-t border-neutral-100 pt-6'>
            <button class='rounded-lg bg-neutral-900 px-8 py-3 font-medium text-white transition-colors hover:bg-neutral-800'>
              Save Changes
            </button>
          </div>
        </main>
      </div>

      {/* Embedded Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

        body {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
      `}</style>
    </div>
  );
}
