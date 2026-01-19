/**
 * ProfileSettings - Combined profile management page in settings
 * Includes: Profile info (avatar, name, email), persona, academic info, account deletion
 */

import { FiUser, FiAlertTriangle } from 'solid-icons/fi';
import ProfileInfoSection from '@/components/settings/pages/ProfileInfoSection.jsx';
import PersonaSection from '@/components/settings/pages/PersonaSection.jsx';
import AcademicInfoSection from '@/components/settings/pages/AcademicInfoSection.jsx';
import DeleteAccountSection from '@/components/settings/pages/DeleteAccountSection.jsx';

export default function ProfileSettings() {
  return (
    <div class='from-background to-muted/80 min-h-full bg-linear-to-br py-8'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <div class='mb-8'>
          <h1 class='text-foreground text-2xl font-semibold tracking-tight'>Profile</h1>
          <p class='text-muted-foreground mt-1'>Manage your personal information</p>
        </div>

        {/* Profile Information Card */}
        <div class='border-border/60 bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-border-subtle bg-primary/5 border-b px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='bg-primary/15 flex h-8 w-8 items-center justify-center rounded-lg'>
                <FiUser class='text-primary h-4 w-4' />
              </div>
              <div>
                <h2 class='text-card-foreground text-base font-semibold'>Personal Information</h2>
                <p class='text-muted-foreground text-sm'>
                  Your profile information visible to project collaborators
                </p>
              </div>
            </div>
          </div>
          <div class='p-6'>
            <ProfileInfoSection />
            <PersonaSection />
            <AcademicInfoSection />
          </div>
        </div>

        {/* Danger Zone Card */}
        <div class='border-border/60 bg-card overflow-hidden rounded-xl border shadow-sm'>
          <div class='border-border-subtle bg-destructive/5 border-b px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='bg-destructive/15 flex h-8 w-8 items-center justify-center rounded-lg'>
                <FiAlertTriangle class='text-destructive h-4 w-4' />
              </div>
              <h2 class='text-card-foreground text-base font-semibold'>Danger Zone</h2>
            </div>
          </div>
          <div class='p-6'>
            <DeleteAccountSection />
          </div>
        </div>
      </div>
    </div>
  );
}
