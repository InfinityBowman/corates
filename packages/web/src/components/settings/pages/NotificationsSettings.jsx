/**
 * NotificationsSettings - Notifications section extracted from SettingsPage
 */

import { createSignal } from 'solid-js';
import { FiBell, FiMoon } from 'solid-icons/fi';
import { SwitchRoot, SwitchControl, SwitchThumb, SwitchHiddenInput } from '@/components/ui/switch';

export default function NotificationsSettings() {
  // Notification settings
  const [emailNotifications, setEmailNotifications] = createSignal(false);
  const [projectUpdates, setProjectUpdates] = createSignal(false);

  // Appearance settings
  const [darkMode, setDarkMode] = createSignal(false);

  return (
    <div class='min-h-full bg-gradient-to-br from-slate-50 to-slate-100/80 py-8'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <div class='mb-8'>
          <h1 class='text-2xl font-semibold tracking-tight text-slate-900'>Notifications</h1>
          <p class='mt-1 text-slate-500'>Configure how you want to receive updates</p>
        </div>

        {/* Notifications Section */}
        <div class='mb-6 overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50'>
                <FiBell class='h-4 w-4 text-blue-600' />
              </div>
              <h2 class='text-base font-semibold text-slate-900'>Email Notifications</h2>
            </div>
          </div>
          <div class='divide-y divide-slate-100 p-6'>
            <div class='flex items-center justify-between pb-4'>
              <div>
                <p class='font-medium text-slate-900'>Email Notifications</p>
                <p class='text-sm text-slate-500'>
                  Receive email notifications about your account.
                </p>
              </div>
              <SwitchRoot checked={emailNotifications()} onCheckedChange={setEmailNotifications}>
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
                <SwitchHiddenInput />
              </SwitchRoot>
            </div>
            <div class='flex items-center justify-between pt-4'>
              <div>
                <p class='font-medium text-slate-900'>Project Updates</p>
                <p class='text-sm text-slate-500'>
                  Get notified when collaborators make changes to your projects.
                </p>
              </div>
              <SwitchRoot checked={projectUpdates()} onCheckedChange={setProjectUpdates}>
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
                <SwitchHiddenInput />
              </SwitchRoot>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div class='mb-6 overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100'>
                <FiMoon class='h-4 w-4 text-slate-600' />
              </div>
              <h2 class='text-base font-semibold text-slate-900'>Appearance</h2>
            </div>
          </div>
          <div class='p-6'>
            <div class='flex items-center justify-between'>
              <div>
                <p class='font-medium text-slate-900'>Dark Mode</p>
                <p class='text-sm text-slate-500'>Use dark theme across the application.</p>
              </div>
              <SwitchRoot checked={darkMode()} onCheckedChange={setDarkMode} disabled>
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
                <SwitchHiddenInput />
              </SwitchRoot>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
