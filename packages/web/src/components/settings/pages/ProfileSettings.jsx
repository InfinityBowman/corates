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
    <div class='min-h-full bg-gradient-to-br from-slate-50 to-slate-100/80 py-8'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <div class='mb-8'>
          <h1 class='text-2xl font-semibold tracking-tight text-slate-900'>Profile</h1>
          <p class='mt-1 text-slate-500'>Manage your personal information</p>
        </div>

        {/* Profile Information Card */}
        <div class='mb-6 overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50'>
                <FiUser class='h-4 w-4 text-blue-600' />
              </div>
              <div>
                <h2 class='text-base font-semibold text-slate-900'>Personal Information</h2>
                <p class='text-sm text-slate-500'>
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
        <div class='overflow-hidden rounded-xl border border-red-200/60 bg-white shadow-sm'>
          <div class='border-b border-red-100 bg-gradient-to-r from-red-50/50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-red-50'>
                <FiAlertTriangle class='h-4 w-4 text-red-600' />
              </div>
              <h2 class='text-base font-semibold text-slate-900'>Danger Zone</h2>
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
