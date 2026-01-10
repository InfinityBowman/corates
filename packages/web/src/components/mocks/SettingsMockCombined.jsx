/**
 * Settings Mock - Combined Profile & Settings
 *
 * Design Direction: Clean, minimal Swiss style with app's blue color scheme.
 * Combines Profile and Settings into one unified experience.
 * Uses sidebar navigation with blue accents and clear hierarchy.
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
  FiCamera,
  FiMail,
  FiKey,
  FiSmartphone,
  FiLogOut,
  FiChevronRight,
  FiCloud,
  FiX,
  FiAlertCircle,
  FiInfo,
  FiArrowLeft,
} from 'solid-icons/fi';

// Mock data from actual app structure
const mockUser = {
  name: 'Dr. Sarah Chen',
  firstName: 'Sarah',
  lastName: 'Chen',
  email: 'sarah.chen@university.edu',
  emailVerified: true,
  persona: 'researcher',
  createdAt: '2024-12-15',
  image: null,
};

const PERSONAS = [
  { id: 'researcher', label: 'Researcher' },
  { id: 'student', label: 'Student' },
  { id: 'librarian', label: 'Librarian' },
  { id: 'clinician', label: 'Clinician' },
  { id: 'other', label: 'Other' },
];

const mockPlan = {
  name: 'Professional',
  status: 'active',
  price: 29,
  interval: 'month',
  nextBilling: 'February 15, 2025',
  features: ['15 Projects', '25 Collaborators', '10 GB Storage', 'Priority Support'],
};

const mockUsage = {
  projects: { used: 8, limit: 15 },
  collaborators: { used: 12, limit: 25 },
  storage: { used: 2.4, limit: 10, unit: 'GB' },
};

const mockLinkedAccounts = [
  { id: '1', providerId: 'google', email: 'sarah.chen@gmail.com' },
  { id: '2', providerId: 'orcid', orcidId: '0000-0002-1234-5678' },
];

const mockSessions = [
  { id: 1, device: 'MacBook Pro', browser: 'Safari', location: 'San Francisco, US', current: true },
  { id: 2, device: 'iPhone 15', browser: 'Safari', location: 'San Francisco, US', current: false },
  { id: 3, device: 'Windows PC', browser: 'Chrome', location: 'New York, US', current: false },
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
];

const navItems = [
  { id: 'profile', label: 'Profile', icon: FiUser },
  { id: 'billing', label: 'Billing', icon: FiCreditCard },
  { id: 'security', label: 'Security', icon: FiShield },
  { id: 'notifications', label: 'Notifications', icon: FiBell },
  { id: 'integrations', label: 'Integrations', icon: FiLink },
];

// Toggle switch with blue accent
function Toggle(props) {
  return (
    <button
      onClick={() => props.onChange?.(!props.checked)}
      class={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
        props.checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <div
        class={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          props.checked ? 'left-0.5' : 'left-0.5'
        }`}
        style={{ transform: props.checked ? 'translateX(22px)' : 'translateX(0)' }}
      />
    </button>
  );
}

// Section component
function Section(props) {
  return (
    <section class='border-t border-gray-100 py-8 first:border-t-0 first:pt-0'>
      <Show when={props.title}>
        <h2 class='mb-1 text-xs font-medium tracking-widest text-gray-400 uppercase'>
          {props.title}
        </h2>
      </Show>
      <Show when={props.subtitle}>
        <p class='mb-6 text-sm text-gray-500'>{props.subtitle}</p>
      </Show>
      {props.children}
    </section>
  );
}

// Setting row component
function SettingRow(props) {
  return (
    <div class='flex items-center justify-between border-b border-gray-100 py-4 last:border-b-0'>
      <div class='flex-1'>
        <h3 class='font-medium text-gray-900'>{props.title}</h3>
        <Show when={props.description}>
          <p class='mt-0.5 text-sm text-gray-500'>{props.description}</p>
        </Show>
      </div>
      <div class='ml-4'>{props.children}</div>
    </div>
  );
}

// Provider card for linked accounts
function ProviderCard(props) {
  const providerInfo = {
    google: { name: 'Google', icon: '/logos/google.svg' },
    orcid: { name: 'ORCID', icon: '/logos/orcid.svg' },
  };

  const info = providerInfo[props.account.providerId] || { name: props.account.providerId };

  return (
    <div class='flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-4'>
      <div class='flex items-center gap-4'>
        <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm'>
          <Show when={info.icon} fallback={<FiMail class='h-5 w-5 text-gray-600' />}>
            <img src={info.icon} alt={info.name} class='h-5 w-5' />
          </Show>
        </div>
        <div>
          <p class='font-medium text-gray-900'>{info.name}</p>
          <p class='text-sm text-gray-500'>
            {props.account.email || props.account.orcidId || 'Connected'}
          </p>
        </div>
      </div>
      <button class='text-sm font-medium text-red-600 hover:text-red-700'>Unlink</button>
    </div>
  );
}

export default function SettingsMockCombined() {
  const [activeNav, setActiveNav] = createSignal('profile');
  const [notifications, setNotifications] = createSignal(
    mockNotificationSettings.reduce((acc, n) => ({ ...acc, [n.id]: n.enabled }), {}),
  );
  const [isEditingName, setIsEditingName] = createSignal(false);
  const [isEditingPersona, setIsEditingPersona] = createSignal(false);
  const [googleDriveConnected, setGoogleDriveConnected] = createSignal(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = createSignal(false);

  const toggleNotification = id => {
    setNotifications(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const userInitials = () => {
    return `${mockUser.firstName.charAt(0)}${mockUser.lastName.charAt(0)}`;
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div class='min-h-screen bg-blue-50/30'>
      {/* Header */}
      <header class='border-b border-gray-200 bg-white'>
        <div class='mx-auto flex max-w-6xl items-center justify-between px-8 py-4'>
          <div class='flex items-center gap-4'>
            <button class='flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'>
              <FiArrowLeft class='h-5 w-5' />
            </button>
            <div class='flex items-center gap-3'>
              <span class='text-xl font-semibold tracking-tight text-gray-900'>CoRATES</span>
              <span class='text-gray-300'>/</span>
              <span class='text-gray-600'>Settings</span>
            </div>
          </div>
          <div class='flex items-center gap-4'>
            <span class='text-sm text-gray-600'>{mockUser.email}</span>
            <div class='flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white'>
              {userInitials()}
            </div>
          </div>
        </div>
      </header>

      <div class='mx-auto flex max-w-6xl'>
        {/* Sidebar Navigation */}
        <nav class='w-56 shrink-0 border-r border-gray-200 bg-white py-6 pr-6'>
          <ul class='space-y-1'>
            <For each={navItems}>
              {item => {
                const Icon = item.icon;
                return (
                  <li>
                    <button
                      onClick={() => setActiveNav(item.id)}
                      class={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                        activeNav() === item.id ?
                          'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
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

          <div class='mt-6 border-t border-gray-200 pt-6'>
            <button class='flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50'>
              <FiLogOut class='h-4 w-4' />
              Sign Out
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main class='flex-1 bg-white px-10 py-8'>
          {/* Profile Section */}
          <Show when={activeNav() === 'profile'}>
            <div class='mb-6'>
              <h1 class='text-2xl font-semibold text-gray-900'>Profile</h1>
              <p class='mt-1 text-gray-500'>Manage your personal information</p>
            </div>

            <Section>
              <div class='flex items-start gap-8'>
                {/* Avatar */}
                <div class='group relative'>
                  <div class='flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-2xl font-semibold text-white'>
                    {userInitials()}
                  </div>
                  <button class='absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100'>
                    <FiCamera class='h-6 w-6 text-white' />
                  </button>
                </div>

                {/* Info */}
                <div class='flex-1'>
                  <Show
                    when={!isEditingName()}
                    fallback={
                      <div class='grid grid-cols-2 gap-6'>
                        <div>
                          <label class='mb-2 block text-xs font-medium tracking-wide text-gray-400 uppercase'>
                            First Name
                          </label>
                          <input
                            type='text'
                            value={mockUser.firstName}
                            class='w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
                          />
                        </div>
                        <div>
                          <label class='mb-2 block text-xs font-medium tracking-wide text-gray-400 uppercase'>
                            Last Name
                          </label>
                          <input
                            type='text'
                            value={mockUser.lastName}
                            class='w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
                          />
                        </div>
                        <div class='col-span-2 flex gap-3'>
                          <button
                            onClick={() => setIsEditingName(false)}
                            class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setIsEditingName(false)}
                            class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    }
                  >
                    <div class='space-y-4'>
                      <div class='flex items-start justify-between'>
                        <div class='grid grid-cols-2 gap-6'>
                          <div>
                            <label class='mb-1 block text-xs font-medium tracking-wide text-gray-400 uppercase'>
                              First Name
                            </label>
                            <p class='text-gray-900'>{mockUser.firstName}</p>
                          </div>
                          <div>
                            <label class='mb-1 block text-xs font-medium tracking-wide text-gray-400 uppercase'>
                              Last Name
                            </label>
                            <p class='text-gray-900'>{mockUser.lastName}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsEditingName(true)}
                          class='text-sm font-medium text-blue-600 hover:text-blue-700'
                        >
                          Edit
                        </button>
                      </div>

                      <div class='border-t border-gray-100 pt-4'>
                        <div class='flex items-start justify-between'>
                          <div>
                            <label class='mb-1 block text-xs font-medium tracking-wide text-gray-400 uppercase'>
                              Persona
                            </label>
                            <Show
                              when={!isEditingPersona()}
                              fallback={
                                <div class='flex items-center gap-3'>
                                  <select class='rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'>
                                    <For each={PERSONAS}>
                                      {p => (
                                        <option value={p.id} selected={p.id === mockUser.persona}>
                                          {p.label}
                                        </option>
                                      )}
                                    </For>
                                  </select>
                                  <button
                                    onClick={() => setIsEditingPersona(false)}
                                    class='rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700'
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setIsEditingPersona(false)}
                                    class='text-sm text-gray-500 hover:text-gray-700'
                                  >
                                    Cancel
                                  </button>
                                </div>
                              }
                            >
                              <div class='flex items-center gap-2'>
                                <p class='text-gray-900'>
                                  {PERSONAS.find(p => p.id === mockUser.persona)?.label ||
                                    'Not set'}
                                </p>
                                <span class='rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700'>
                                  {PERSONAS.find(p => p.id === mockUser.persona)?.label}
                                </span>
                              </div>
                            </Show>
                          </div>
                          <Show when={!isEditingPersona()}>
                            <button
                              onClick={() => setIsEditingPersona(true)}
                              class='text-sm font-medium text-blue-600 hover:text-blue-700'
                            >
                              Edit
                            </button>
                          </Show>
                        </div>
                      </div>

                      <div class='border-t border-gray-100 pt-4'>
                        <label class='mb-1 block text-xs font-medium tracking-wide text-gray-400 uppercase'>
                          Email
                        </label>
                        <div class='flex items-center gap-2'>
                          <p class='text-gray-900'>{mockUser.email}</p>
                          <Show when={mockUser.emailVerified}>
                            <span class='flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'>
                              <FiCheck class='h-3 w-3' />
                              Verified
                            </span>
                          </Show>
                        </div>
                      </div>

                      <div class='border-t border-gray-100 pt-4'>
                        <label class='mb-1 block text-xs font-medium tracking-wide text-gray-400 uppercase'>
                          Member Since
                        </label>
                        <p class='text-gray-900'>{formatDate(mockUser.createdAt)}</p>
                      </div>
                    </div>
                  </Show>
                </div>
              </div>
            </Section>

            <Section title='Danger Zone'>
              <div class='rounded-xl border border-red-200 bg-red-50/50 p-5'>
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
            <div class='mb-6'>
              <h1 class='text-2xl font-semibold text-gray-900'>Billing</h1>
              <p class='mt-1 text-gray-500'>Manage your subscription and payments</p>
            </div>

            <Section>
              <div class='flex gap-6'>
                {/* Plan Card */}
                <div class='flex-1 rounded-2xl border border-gray-200 p-6'>
                  <div class='mb-4 flex items-start justify-between'>
                    <div>
                      <p class='text-xs font-medium tracking-widest text-gray-400 uppercase'>
                        Current Plan
                      </p>
                      <h2 class='mt-1 text-2xl font-semibold text-gray-900'>{mockPlan.name}</h2>
                    </div>
                    <span class='rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700'>
                      Active
                    </span>
                  </div>

                  <div class='mb-4'>
                    <span class='text-3xl font-bold text-gray-900'>${mockPlan.price}</span>
                    <span class='text-gray-500'>/{mockPlan.interval}</span>
                  </div>

                  <p class='mb-4 text-sm text-gray-500'>Next billing: {mockPlan.nextBilling}</p>

                  <ul class='space-y-2'>
                    <For each={mockPlan.features}>
                      {feature => (
                        <li class='flex items-center gap-2 text-sm text-gray-600'>
                          <FiCheck class='h-4 w-4 text-green-600' />
                          {feature}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>

                {/* Quick Actions */}
                <div class='flex w-56 flex-col gap-3'>
                  <button class='flex items-center justify-between rounded-xl bg-blue-600 px-5 py-4 text-left text-white transition-colors hover:bg-blue-700'>
                    <span class='font-medium'>Change Plan</span>
                    <FiArrowRight class='h-4 w-4' />
                  </button>
                  <button class='flex items-center justify-between rounded-xl border border-gray-200 px-5 py-4 text-left text-gray-900 transition-colors hover:bg-gray-50'>
                    <span class='font-medium'>Payment Method</span>
                    <FiCreditCard class='h-4 w-4 text-gray-400' />
                  </button>
                  <button class='flex items-center justify-between rounded-xl border border-gray-200 px-5 py-4 text-left text-gray-900 transition-colors hover:bg-gray-50'>
                    <span class='font-medium'>Billing History</span>
                    <FiChevronRight class='h-4 w-4 text-gray-400' />
                  </button>
                </div>
              </div>
            </Section>

            <Section title='Usage This Period'>
              <div class='grid grid-cols-3 gap-4'>
                <div class='rounded-xl border border-gray-100 bg-gray-50/50 p-5'>
                  <p class='text-xs font-medium tracking-widest text-gray-400 uppercase'>
                    Projects
                  </p>
                  <p class='mt-2 text-3xl font-bold text-gray-900'>
                    {mockUsage.projects.used}
                    <span class='text-lg font-normal text-gray-400'>
                      /{mockUsage.projects.limit}
                    </span>
                  </p>
                  <div class='mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200'>
                    <div
                      class='h-full rounded-full bg-blue-600 transition-all'
                      style={{
                        width: `${(mockUsage.projects.used / mockUsage.projects.limit) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div class='rounded-xl border border-gray-100 bg-gray-50/50 p-5'>
                  <p class='text-xs font-medium tracking-widest text-gray-400 uppercase'>
                    Collaborators
                  </p>
                  <p class='mt-2 text-3xl font-bold text-gray-900'>
                    {mockUsage.collaborators.used}
                    <span class='text-lg font-normal text-gray-400'>
                      /{mockUsage.collaborators.limit}
                    </span>
                  </p>
                  <div class='mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200'>
                    <div
                      class='h-full rounded-full bg-blue-600 transition-all'
                      style={{
                        width: `${(mockUsage.collaborators.used / mockUsage.collaborators.limit) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div class='rounded-xl border border-gray-100 bg-gray-50/50 p-5'>
                  <p class='text-xs font-medium tracking-widest text-gray-400 uppercase'>Storage</p>
                  <p class='mt-2 text-3xl font-bold text-gray-900'>
                    {mockUsage.storage.used}
                    <span class='text-lg font-normal text-gray-400'>
                      /{mockUsage.storage.limit} {mockUsage.storage.unit}
                    </span>
                  </p>
                  <div class='mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200'>
                    <div
                      class='h-full rounded-full bg-blue-600 transition-all'
                      style={{
                        width: `${(mockUsage.storage.used / mockUsage.storage.limit) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Section>
          </Show>

          {/* Security Section */}
          <Show when={activeNav() === 'security'}>
            <div class='mb-6'>
              <h1 class='text-2xl font-semibold text-gray-900'>Security</h1>
              <p class='mt-1 text-gray-500'>Protect your account</p>
            </div>

            <Section title='Linked Accounts' subtitle='Manage how you sign in to CoRATES'>
              <div class='space-y-3'>
                <For each={mockLinkedAccounts}>{account => <ProviderCard account={account} />}</For>
              </div>

              <div class='mt-4 flex flex-wrap gap-2'>
                <button class='inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'>
                  <FiMail class='h-4 w-4' />+ Email & Password
                </button>
              </div>

              <div class='mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4'>
                <div class='flex items-start gap-3'>
                  <FiInfo class='mt-0.5 h-5 w-5 shrink-0 text-blue-600' />
                  <p class='text-sm text-blue-800'>
                    <strong>Why link accounts?</strong> Linking multiple sign-in methods gives you
                    backup options if you lose access to one.
                  </p>
                </div>
              </div>
            </Section>

            <Section title='Authentication'>
              <SettingRow
                title='Password'
                description='Set a password to sign in without email links'
              >
                <button class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'>
                  Add Password
                </button>
              </SettingRow>

              <SettingRow
                title='Two-Factor Authentication'
                description={twoFactorEnabled() ? 'Enabled' : 'Add an extra layer of security'}
              >
                <Show
                  when={twoFactorEnabled()}
                  fallback={
                    <button
                      onClick={() => setTwoFactorEnabled(true)}
                      class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
                    >
                      Enable
                    </button>
                  }
                >
                  <div class='flex items-center gap-3'>
                    <span class='flex items-center gap-1 text-sm text-green-600'>
                      <FiCheck class='h-4 w-4' />
                      Enabled
                    </span>
                    <button class='rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'>
                      Manage
                    </button>
                  </div>
                </Show>
              </SettingRow>
            </Section>

            <Section title='Active Sessions' subtitle='Devices currently logged into your account'>
              <div class='space-y-3'>
                <For each={mockSessions}>
                  {session => (
                    <div class='flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/30 p-4'>
                      <div class='flex items-center gap-4'>
                        <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm'>
                          <FiMonitor class='h-5 w-5' />
                        </div>
                        <div>
                          <p class='font-medium text-gray-900'>
                            {session.device}
                            <Show when={session.current}>
                              <span class='ml-2 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'>
                                Current
                              </span>
                            </Show>
                          </p>
                          <p class='text-sm text-gray-500'>
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

              <button class='mt-4 text-sm font-medium text-red-600 hover:text-red-700'>
                Sign out all other devices
              </button>
            </Section>
          </Show>

          {/* Notifications Section */}
          <Show when={activeNav() === 'notifications'}>
            <div class='mb-6'>
              <h1 class='text-2xl font-semibold text-gray-900'>Notifications</h1>
              <p class='mt-1 text-gray-500'>Control how you receive updates</p>
            </div>

            <Section title='Email Preferences'>
              <For each={mockNotificationSettings}>
                {setting => (
                  <SettingRow title={setting.title} description={setting.description}>
                    <Toggle
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
            <div class='mb-6'>
              <h1 class='text-2xl font-semibold text-gray-900'>Integrations</h1>
              <p class='mt-1 text-gray-500'>
                Connect third-party services to enhance your workflow
              </p>
            </div>

            <Section>
              {/* Google Drive */}
              <div class='flex items-center justify-between rounded-xl border border-gray-200 p-5'>
                <div class='flex items-center gap-4'>
                  <div class='flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100'>
                    <img src='/logos/drive.svg' alt='Google Drive' class='h-6 w-6' />
                  </div>
                  <div>
                    <h3 class='font-medium text-gray-900'>Google Drive</h3>
                    <p class='text-sm text-gray-500'>
                      {googleDriveConnected() ?
                        'Connected - You can import PDFs from your Drive'
                      : 'Connect to import PDFs from Google Drive'}
                    </p>
                  </div>
                </div>
                <Show
                  when={googleDriveConnected()}
                  fallback={
                    <button
                      onClick={() => setGoogleDriveConnected(true)}
                      class='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
                    >
                      Connect
                    </button>
                  }
                >
                  <div class='flex items-center gap-3'>
                    <span class='flex items-center gap-1 text-sm text-green-600'>
                      <FiCheck class='h-4 w-4' />
                      Connected
                    </span>
                    <button
                      onClick={() => setGoogleDriveConnected(false)}
                      class='inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100'
                    >
                      <FiX class='h-4 w-4' />
                      Disconnect
                    </button>
                  </div>
                </Show>
              </div>

              {/* Other integrations */}
              <div class='mt-4 space-y-3'>
                {[
                  { name: 'Zotero', description: 'Sync your reference library', available: false },
                  {
                    name: 'Mendeley',
                    description: 'Import references and annotations',
                    available: false,
                  },
                ].map(integration => (
                  <div class='flex items-center justify-between rounded-xl border border-gray-200 p-5 opacity-60'>
                    <div class='flex items-center gap-4'>
                      <div class='flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100'>
                        <FiLink class='h-6 w-6 text-gray-400' />
                      </div>
                      <div>
                        <h3 class='font-medium text-gray-900'>{integration.name}</h3>
                        <p class='text-sm text-gray-500'>{integration.description}</p>
                      </div>
                    </div>
                    <span class='rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500'>
                      Coming Soon
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </Show>

          {/* Save Button */}
          <div class='mt-8 flex justify-end border-t border-gray-100 pt-6'>
            <button class='rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-700'>
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
