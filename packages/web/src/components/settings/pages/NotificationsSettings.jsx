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
    <div class='bg-background min-h-full py-8'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <div class='mb-8'>
          <h1 class='text-foreground text-2xl font-semibold tracking-tight'>Notifications</h1>
          <p class='text-muted-foreground mt-1'>Configure how you want to receive updates</p>
        </div>

        {/* Notifications Section */}
        <div class='border-border bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-border-subtle border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='bg-primary-subtle flex h-8 w-8 items-center justify-center rounded-lg'>
                <FiBell class='text-primary h-4 w-4' />
              </div>
              <h2 class='text-foreground text-base font-semibold'>Email Notifications</h2>
            </div>
          </div>
          <div class='divide-border-subtle divide-y p-6'>
            <div class='flex items-center justify-between pb-4'>
              <div>
                <p class='text-foreground font-medium'>Email Notifications</p>
                <p class='text-muted-foreground text-sm'>
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
                <p class='text-foreground font-medium'>Project Updates</p>
                <p class='text-muted-foreground text-sm'>
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
        <div class='border-border bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-border-subtle border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='bg-secondary flex h-8 w-8 items-center justify-center rounded-lg'>
                <FiMoon class='text-secondary-foreground h-4 w-4' />
              </div>
              <h2 class='text-foreground text-base font-semibold'>Appearance</h2>
            </div>
          </div>
          <div class='p-6'>
            <div class='flex items-center justify-between'>
              <div>
                <p class='text-foreground font-medium'>Dark Mode</p>
                <p class='text-muted-foreground text-sm'>Use dark theme across the application.</p>
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
