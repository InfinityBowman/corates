/**
 * Settings Mock - Bento Box Style
 *
 * Design Direction: Modern dashboard-inspired bento grid layout.
 * Uses varied card sizes, soft shadows, and gradient accents.
 * Inspired by Apple's latest design language and modern SaaS dashboards.
 */

import { For, Show, createSignal } from 'solid-js';
import {
  FiUser,
  FiCreditCard,
  FiShield,
  FiBell,
  FiLink,
  FiMonitor,
  FiMoon,
  FiSun,
  FiCheck,
  FiChevronRight,
  FiArrowLeft,
  FiMail,
  FiCloud,
  FiHardDrive,
  FiZap,
  FiUsers,
  FiFolder,
  FiLock,
  FiSmartphone,
  FiGlobe,
} from 'solid-icons/fi';

// Mock data
const mockUser = {
  name: 'Dr. Sarah Chen',
  email: 'sarah.chen@university.edu',
  avatar: null,
  initials: 'SC',
  plan: 'Professional',
  planColor: 'from-violet-500 to-purple-600',
};

const mockSubscription = {
  plan: 'Professional',
  status: 'active',
  nextBilling: 'Feb 15, 2025',
  price: '$29/month',
};

const mockUsage = {
  projects: { used: 8, limit: 15 },
  collaborators: { used: 12, limit: 25 },
  storage: { used: 2.4, limit: 10, unit: 'GB' },
};

const mockSessions = [
  { device: 'MacBook Pro', location: 'San Francisco, US', current: true, lastActive: 'Now' },
  { device: 'iPhone 15', location: 'San Francisco, US', current: false, lastActive: '2 hours ago' },
  {
    device: 'Chrome on Windows',
    location: 'New York, US',
    current: false,
    lastActive: 'Yesterday',
  },
];

const mockIntegrations = [
  { name: 'Google Drive', icon: FiCloud, connected: true, color: 'text-blue-500' },
  { name: 'Dropbox', icon: FiHardDrive, connected: false, color: 'text-blue-600' },
  { name: 'Zotero', icon: FiFolder, connected: false, color: 'text-red-500' },
];

// Reusable card component
function BentoCard(props) {
  return (
    <div
      class={`group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 ${props.class || ''}`}
      style={props.style}
    >
      {props.children}
    </div>
  );
}

// Progress ring component
function ProgressRing(props) {
  const percentage = () => (props.used / props.limit) * 100;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = () => circumference - (percentage() / 100) * circumference;

  return (
    <div class='relative h-24 w-24'>
      <svg class='h-24 w-24 -rotate-90' viewBox='0 0 80 80'>
        <circle cx='40' cy='40' r='36' stroke='#f1f5f9' stroke-width='6' fill='none' />
        <circle
          cx='40'
          cy='40'
          r='36'
          stroke={props.color || '#8b5cf6'}
          stroke-width='6'
          fill='none'
          stroke-linecap='round'
          style={{
            'stroke-dasharray': `${circumference}`,
            'stroke-dashoffset': `${strokeDashoffset()}`,
            transition: 'stroke-dashoffset 0.5s ease-out',
          }}
        />
      </svg>
      <div class='absolute inset-0 flex flex-col items-center justify-center'>
        <span class='text-lg font-bold text-slate-900'>{props.used}</span>
        <span class='text-xs text-slate-400'>/ {props.limit}</span>
      </div>
    </div>
  );
}

// Toggle switch component
function Toggle(props) {
  return (
    <button
      onClick={() => props.onChange?.(!props.checked)}
      class={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
        props.checked ? 'bg-violet-500' : 'bg-slate-200'
      }`}
    >
      <div
        class={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          props.checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function SettingsMockBento() {
  const [darkMode, setDarkMode] = createSignal(false);
  const [emailNotifications, setEmailNotifications] = createSignal(true);
  const [projectUpdates, setProjectUpdates] = createSignal(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = createSignal(false);

  return (
    <div class='min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30'>
      {/* Header */}
      <header class='sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl'>
        <div class='mx-auto max-w-7xl px-6 py-4'>
          <div class='flex items-center justify-between'>
            <div class='flex items-center gap-4'>
              <button class='flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'>
                <FiArrowLeft class='h-5 w-5' />
              </button>
              <div>
                <h1 class='text-xl font-semibold text-slate-900'>Settings</h1>
                <p class='text-sm text-slate-500'>Manage your account and preferences</p>
              </div>
            </div>
            <div class='flex items-center gap-3'>
              <button
                class='flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'
                onClick={() => setDarkMode(!darkMode())}
              >
                <Show when={darkMode()} fallback={<FiMoon class='h-5 w-5' />}>
                  <FiSun class='h-5 w-5' />
                </Show>
              </button>
              <div class='flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-medium text-white'>
                {mockUser.initials}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main class='mx-auto max-w-7xl px-6 py-8'>
        {/* Bento Grid */}
        <div class='grid grid-cols-12 gap-5'>
          {/* Profile Card - Large */}
          <BentoCard class='col-span-12 md:col-span-8'>
            <div class='flex items-start justify-between'>
              <div class='flex items-center gap-5'>
                <div class='relative'>
                  <div class='flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-2xl font-semibold text-white shadow-lg shadow-violet-500/25'>
                    {mockUser.initials}
                  </div>
                  <div class='absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white'>
                    <FiCheck class='h-3.5 w-3.5' />
                  </div>
                </div>
                <div>
                  <h2 class='text-xl font-semibold text-slate-900'>{mockUser.name}</h2>
                  <p class='text-sm text-slate-500'>{mockUser.email}</p>
                  <div class='mt-2 flex items-center gap-2'>
                    <span class='inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700'>
                      <FiZap class='h-3 w-3' />
                      {mockUser.plan}
                    </span>
                  </div>
                </div>
              </div>
              <button class='rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50'>
                Edit Profile
              </button>
            </div>
          </BentoCard>

          {/* Quick Stats Card */}
          <BentoCard class='col-span-12 md:col-span-4'>
            <div class='flex h-full flex-col'>
              <h3 class='mb-4 text-sm font-medium tracking-wide text-slate-400 uppercase'>
                Quick Stats
              </h3>
              <div class='flex flex-1 items-center justify-around'>
                <div class='text-center'>
                  <p class='text-3xl font-bold text-slate-900'>{mockUsage.projects.used}</p>
                  <p class='text-xs text-slate-500'>Projects</p>
                </div>
                <div class='h-12 w-px bg-slate-100' />
                <div class='text-center'>
                  <p class='text-3xl font-bold text-slate-900'>{mockUsage.collaborators.used}</p>
                  <p class='text-xs text-slate-500'>Collaborators</p>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Subscription Card */}
          <BentoCard class='col-span-12 md:col-span-4'>
            <div class='absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 opacity-[0.03]' />
            <div class='relative'>
              <div class='mb-4 flex items-center justify-between'>
                <div class='flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600'>
                  <FiCreditCard class='h-5 w-5' />
                </div>
                <span class='rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700'>
                  Active
                </span>
              </div>
              <h3 class='text-lg font-semibold text-slate-900'>{mockSubscription.plan}</h3>
              <p class='text-2xl font-bold text-slate-900'>{mockSubscription.price}</p>
              <p class='mt-1 text-sm text-slate-500'>
                Next billing: {mockSubscription.nextBilling}
              </p>
              <button class='mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800'>
                Manage Plan
              </button>
            </div>
          </BentoCard>

          {/* Usage Card */}
          <BentoCard class='col-span-12 md:col-span-4'>
            <h3 class='mb-4 text-sm font-medium tracking-wide text-slate-400 uppercase'>Usage</h3>
            <div class='flex items-center justify-around'>
              <div class='text-center'>
                <ProgressRing
                  used={mockUsage.projects.used}
                  limit={mockUsage.projects.limit}
                  color='#8b5cf6'
                />
                <p class='mt-2 text-xs font-medium text-slate-600'>Projects</p>
              </div>
              <div class='text-center'>
                <ProgressRing
                  used={mockUsage.collaborators.used}
                  limit={mockUsage.collaborators.limit}
                  color='#06b6d4'
                />
                <p class='mt-2 text-xs font-medium text-slate-600'>Collaborators</p>
              </div>
            </div>
          </BentoCard>

          {/* Storage Card */}
          <BentoCard class='col-span-12 md:col-span-4'>
            <div class='mb-4 flex items-center justify-between'>
              <div class='flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600'>
                <FiHardDrive class='h-5 w-5' />
              </div>
              <span class='text-sm text-slate-500'>
                {mockUsage.storage.used} / {mockUsage.storage.limit} {mockUsage.storage.unit}
              </span>
            </div>
            <h3 class='mb-3 text-sm font-medium text-slate-700'>Storage</h3>
            <div class='h-3 overflow-hidden rounded-full bg-slate-100'>
              <div
                class='h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all'
                style={{
                  width: `${(mockUsage.storage.used / mockUsage.storage.limit) * 100}%`,
                }}
              />
            </div>
            <p class='mt-2 text-xs text-slate-500'>
              {((mockUsage.storage.used / mockUsage.storage.limit) * 100).toFixed(0)}% used
            </p>
          </BentoCard>

          {/* Security Card - Full width */}
          <BentoCard class='col-span-12'>
            <div class='mb-6 flex items-center justify-between'>
              <div class='flex items-center gap-3'>
                <div class='flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600'>
                  <FiShield class='h-5 w-5' />
                </div>
                <div>
                  <h3 class='font-semibold text-slate-900'>Security</h3>
                  <p class='text-sm text-slate-500'>Manage your account security settings</p>
                </div>
              </div>
            </div>
            <div class='grid gap-4 md:grid-cols-3'>
              {/* Password */}
              <div class='rounded-2xl border border-slate-100 bg-slate-50/50 p-5'>
                <div class='mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm'>
                  <FiLock class='h-5 w-5' />
                </div>
                <h4 class='font-medium text-slate-900'>Password</h4>
                <p class='mt-1 text-sm text-slate-500'>Last changed 30 days ago</p>
                <button class='mt-3 text-sm font-medium text-violet-600 hover:text-violet-700'>
                  Change Password
                </button>
              </div>

              {/* Two-Factor */}
              <div class='rounded-2xl border border-slate-100 bg-slate-50/50 p-5'>
                <div class='mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm'>
                  <FiSmartphone class='h-5 w-5' />
                </div>
                <h4 class='font-medium text-slate-900'>Two-Factor Auth</h4>
                <p class='mt-1 text-sm text-slate-500'>
                  {twoFactorEnabled() ? 'Enabled' : 'Not enabled'}
                </p>
                <button
                  class='mt-3 text-sm font-medium text-violet-600 hover:text-violet-700'
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled())}
                >
                  {twoFactorEnabled() ? 'Manage' : 'Enable'}
                </button>
              </div>

              {/* Sessions */}
              <div class='rounded-2xl border border-slate-100 bg-slate-50/50 p-5'>
                <div class='mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm'>
                  <FiMonitor class='h-5 w-5' />
                </div>
                <h4 class='font-medium text-slate-900'>Active Sessions</h4>
                <p class='mt-1 text-sm text-slate-500'>{mockSessions.length} devices</p>
                <button class='mt-3 text-sm font-medium text-violet-600 hover:text-violet-700'>
                  View All
                </button>
              </div>
            </div>
          </BentoCard>

          {/* Notifications Card */}
          <BentoCard class='col-span-12 md:col-span-6'>
            <div class='mb-5 flex items-center gap-3'>
              <div class='flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600'>
                <FiBell class='h-5 w-5' />
              </div>
              <h3 class='font-semibold text-slate-900'>Notifications</h3>
            </div>
            <div class='space-y-4'>
              <div class='flex items-center justify-between'>
                <div>
                  <p class='font-medium text-slate-900'>Email Notifications</p>
                  <p class='text-sm text-slate-500'>Receive important updates via email</p>
                </div>
                <Toggle checked={emailNotifications()} onChange={setEmailNotifications} />
              </div>
              <div class='h-px bg-slate-100' />
              <div class='flex items-center justify-between'>
                <div>
                  <p class='font-medium text-slate-900'>Project Updates</p>
                  <p class='text-sm text-slate-500'>Notifications about project changes</p>
                </div>
                <Toggle checked={projectUpdates()} onChange={setProjectUpdates} />
              </div>
            </div>
          </BentoCard>

          {/* Integrations Card */}
          <BentoCard class='col-span-12 md:col-span-6'>
            <div class='mb-5 flex items-center justify-between'>
              <div class='flex items-center gap-3'>
                <div class='flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600'>
                  <FiLink class='h-5 w-5' />
                </div>
                <h3 class='font-semibold text-slate-900'>Integrations</h3>
              </div>
              <button class='text-sm font-medium text-violet-600 hover:text-violet-700'>
                See all
              </button>
            </div>
            <div class='space-y-3'>
              <For each={mockIntegrations}>
                {integration => {
                  const Icon = integration.icon;
                  return (
                    <div class='flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4'>
                      <div class='flex items-center gap-3'>
                        <div
                          class={`flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ${integration.color}`}
                        >
                          <Icon class='h-5 w-5' />
                        </div>
                        <span class='font-medium text-slate-900'>{integration.name}</span>
                      </div>
                      <Show
                        when={integration.connected}
                        fallback={
                          <button class='rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100'>
                            Connect
                          </button>
                        }
                      >
                        <span class='flex items-center gap-1 text-sm text-emerald-600'>
                          <FiCheck class='h-4 w-4' />
                          Connected
                        </span>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </BentoCard>

          {/* Active Sessions Card */}
          <BentoCard class='col-span-12'>
            <div class='mb-5 flex items-center justify-between'>
              <div class='flex items-center gap-3'>
                <div class='flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600'>
                  <FiGlobe class='h-5 w-5' />
                </div>
                <div>
                  <h3 class='font-semibold text-slate-900'>Active Sessions</h3>
                  <p class='text-sm text-slate-500'>Devices currently logged into your account</p>
                </div>
              </div>
              <button class='text-sm font-medium text-red-600 hover:text-red-700'>
                Sign out all devices
              </button>
            </div>
            <div class='space-y-3'>
              <For each={mockSessions}>
                {session => (
                  <div class='flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4'>
                    <div class='flex items-center gap-4'>
                      <div class='flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm'>
                        <FiMonitor class='h-5 w-5' />
                      </div>
                      <div>
                        <div class='flex items-center gap-2'>
                          <p class='font-medium text-slate-900'>{session.device}</p>
                          <Show when={session.current}>
                            <span class='rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'>
                              Current
                            </span>
                          </Show>
                        </div>
                        <p class='text-sm text-slate-500'>
                          {session.location} - {session.lastActive}
                        </p>
                      </div>
                    </div>
                    <Show when={!session.current}>
                      <button class='rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600'>
                        Revoke
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </BentoCard>
        </div>
      </main>

      {/* Embedded Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        body {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
      `}</style>
    </div>
  );
}
