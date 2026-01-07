/**
 * NotificationsSettings - Notifications section extracted from SettingsPage
 */

import { createSignal } from 'solid-js';
import { FiBell, FiMoon } from 'solid-icons/fi';
import { Switch } from '@corates/ui';

export default function NotificationsSettings() {
  // Notification settings
  const [emailNotifications, setEmailNotifications] = createSignal(false);
  const [projectUpdates, setProjectUpdates] = createSignal(false);

  // Appearance settings
  const [darkMode, setDarkMode] = createSignal(false);

  return (
    <div class='min-h-full bg-blue-50 py-6'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <h1 class='mb-6 text-2xl font-bold text-gray-900'>Notifications</h1>

        {/* Notifications Section */}
        <div class='mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
          <div class='border-b border-gray-200 bg-gray-50 px-6 py-4'>
            <div class='flex items-center space-x-2'>
              <FiBell class='h-5 w-5 text-gray-600' />
              <h2 class='text-lg font-medium text-gray-900'>Email Notifications</h2>
            </div>
          </div>
          <div class='space-y-4 p-6'>
            <div class='flex items-center justify-between'>
              <div>
                <p class='font-medium text-gray-900'>Email Notifications</p>
                <p class='text-sm text-gray-500'>Receive email notifications about your account.</p>
              </div>
              <Switch checked={emailNotifications()} onChange={setEmailNotifications} />
            </div>
            <div class='flex items-center justify-between'>
              <div>
                <p class='font-medium text-gray-900'>Project Updates</p>
                <p class='text-sm text-gray-500'>
                  Get notified when collaborators make changes to your projects.
                </p>
              </div>
              <Switch checked={projectUpdates()} onChange={setProjectUpdates} />
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div class='mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
          <div class='border-b border-gray-200 bg-gray-50 px-6 py-4'>
            <div class='flex items-center space-x-2'>
              <FiMoon class='h-5 w-5 text-gray-600' />
              <h2 class='text-lg font-medium text-gray-900'>Appearance</h2>
            </div>
          </div>
          <div class='p-6'>
            <div class='flex items-center justify-between'>
              <div>
                <p class='font-medium text-gray-900'>Dark Mode</p>
                <p class='text-sm text-gray-500'>Use dark theme across the application.</p>
              </div>
              <Switch checked={darkMode()} onChange={setDarkMode} disabled />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
