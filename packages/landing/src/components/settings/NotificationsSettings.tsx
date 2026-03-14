/**
 * NotificationsSettings - Notification preferences and appearance
 * All toggles are UI-only stubs with no persistence yet.
 */

import { useState } from 'react';
import { BellIcon, MoonIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export function NotificationsSettings() {
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [projectUpdates, setProjectUpdates] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className='bg-background min-h-full py-8'>
      <div className='mx-auto max-w-3xl px-4 sm:px-6'>
        <div className='mb-8'>
          <h1 className='text-foreground text-2xl font-semibold tracking-tight'>Notifications</h1>
          <p className='text-muted-foreground mt-1'>Configure how you want to receive updates</p>
        </div>

        {/* Notifications Section */}
        <div className='border-border/60 bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div className='border-border bg-primary/5 border-b px-6 py-4'>
            <div className='flex items-center space-x-2.5'>
              <div className='bg-primary/15 flex h-8 w-8 items-center justify-center rounded-lg'>
                <BellIcon className='text-primary h-4 w-4' />
              </div>
              <h2 className='text-foreground text-base font-semibold'>Email Notifications</h2>
            </div>
          </div>
          <div className='divide-border divide-y p-6'>
            <div className='flex items-center justify-between pb-4'>
              <div>
                <p className='text-foreground font-medium'>Email Notifications</p>
                <p className='text-muted-foreground text-sm'>
                  Receive email notifications about your account.
                </p>
              </div>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>
            <div className='flex items-center justify-between pt-4'>
              <div>
                <p className='text-foreground font-medium'>Project Updates</p>
                <p className='text-muted-foreground text-sm'>
                  Get notified when collaborators make changes to your projects.
                </p>
              </div>
              <Switch checked={projectUpdates} onCheckedChange={setProjectUpdates} />
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className='border-border/60 bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div className='border-border from-muted/50 to-background border-b bg-gradient-to-r px-6 py-4'>
            <div className='flex items-center space-x-2.5'>
              <div className='bg-secondary flex h-8 w-8 items-center justify-center rounded-lg'>
                <MoonIcon className='text-secondary-foreground h-4 w-4' />
              </div>
              <h2 className='text-foreground text-base font-semibold'>Appearance</h2>
            </div>
          </div>
          <div className='p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-foreground font-medium'>Dark Mode</p>
                <p className='text-muted-foreground text-sm'>
                  Use dark theme across the application.
                </p>
              </div>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} disabled />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
