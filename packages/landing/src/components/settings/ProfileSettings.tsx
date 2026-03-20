/**
 * ProfileSettings - Combined profile management page
 * Includes: Profile info (avatar, name, email), persona, academic info, account deletion
 */

import { UserIcon, TriangleAlertIcon } from 'lucide-react';
import { ProfileInfoSection } from './ProfileInfoSection';
import { PersonaSection } from './PersonaSection';
import { AcademicInfoSection } from './AcademicInfoSection';
import { DeleteAccountSection } from './DeleteAccountSection';

export function ProfileSettings() {
  return (
    <div className='from-background to-muted/80 min-h-full bg-gradient-to-br py-8'>
      <div className='mx-auto max-w-3xl px-4 sm:px-6'>
        <div className='mb-8'>
          <h1 className='text-foreground text-2xl font-semibold tracking-tight'>Profile</h1>
          <p className='text-muted-foreground mt-1'>Manage your personal information</p>
        </div>

        {/* Profile Information Card */}
        <div className='border-border/60 bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div className='border-border bg-primary/5 border-b px-6 py-4'>
            <div className='flex items-center gap-2.5'>
              <div className='bg-primary/15 flex size-8 items-center justify-center rounded-lg'>
                <UserIcon className='text-primary size-4' />
              </div>
              <div>
                <h2 className='text-card-foreground text-base font-semibold'>
                  Personal Information
                </h2>
                <p className='text-muted-foreground text-sm'>
                  Your profile information visible to project collaborators
                </p>
              </div>
            </div>
          </div>
          <div className='p-6'>
            <ProfileInfoSection />
            <PersonaSection />
            <AcademicInfoSection />
          </div>
        </div>

        {/* Danger Zone Card */}
        <div className='border-border/60 bg-card overflow-hidden rounded-xl border shadow-sm'>
          <div className='border-border bg-destructive/5 border-b px-6 py-4'>
            <div className='flex items-center gap-2.5'>
              <div className='bg-destructive/15 flex size-8 items-center justify-center rounded-lg'>
                <TriangleAlertIcon className='text-destructive size-4' />
              </div>
              <h2 className='text-card-foreground text-base font-semibold'>Danger Zone</h2>
            </div>
          </div>
          <div className='p-6'>
            <DeleteAccountSection />
          </div>
        </div>
      </div>
    </div>
  );
}
