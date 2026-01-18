/**
 * ProfileInfoSection - Avatar, name, email, and member since fields
 * Handles avatar upload with compression and optimistic updates
 */

import { createSignal, Show } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { FiCamera, FiCheck } from 'solid-icons/fi';
import { showToast } from '@/components/ui/toast';
import { SimpleEditable } from '@/components/ui/editable';
import { API_BASE } from '@config/api.js';
import { compressImageFile } from '@lib/imageUtils.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const AVATAR_MAX_SIZE = 256;
const AVATAR_QUALITY = 0.85;

/**
 * Sync profile changes to all projects the user is a member of
 */
async function syncProfileToProjects() {
  try {
    await fetch(`${API_BASE}/api/users/sync-profile`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.error('Failed to sync profile to projects:', err);
  }
}

export default function ProfileInfoSection() {
  const auth = useBetterAuth();
  const user = () => auth.user();

  // Avatar state
  const [uploadingImage, setUploadingImage] = createSignal(false);
  const [optimisticImage, setOptimisticImage] = createSignal(null);
  let fileInputRef;

  const avatarUrl = () => optimisticImage() || user()?.image || null;

  const firstName = () => {
    const name = user()?.name || '';
    const parts = name.split(' ');
    return parts[0] || '';
  };

  const lastName = () => {
    const name = user()?.name || '';
    const parts = name.split(' ');
    return parts.slice(1).join(' ') || '';
  };

  const userInitials = () => {
    const first = firstName();
    const last = lastName();
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    }
    return (first || user()?.email || 'U').charAt(0).toUpperCase();
  };

  const formatDate = dateString => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleFirstNameChange = async newFirstName => {
    const trimmed = newFirstName?.trim() || '';
    if (trimmed === firstName()) return;

    const fullName = `${trimmed} ${lastName()}`.trim();
    try {
      await auth.updateProfile({ name: fullName });
      syncProfileToProjects();
    } catch (err) {
      console.warn('Failed to update first name:', err.message);
      showToast.error('Update Failed', 'Failed to update name. Please try again.');
    }
  };

  const handleLastNameChange = async newLastName => {
    const trimmed = newLastName?.trim() || '';
    if (trimmed === lastName()) return;

    const fullName = `${firstName()} ${trimmed}`.trim();
    try {
      await auth.updateProfile({ name: fullName });
      syncProfileToProjects();
    } catch (err) {
      console.warn('Failed to update last name:', err.message);
      showToast.error('Update Failed', 'Failed to update name. Please try again.');
    }
  };

  const handleImageSelect = async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast.error('Invalid File', 'Please select a JPEG, PNG, GIF, or WebP image.');
      return;
    }

    setUploadingImage(true);
    let localUrl = null;

    try {
      const compressedFile = await compressImageFile(file, {
        maxSize: AVATAR_MAX_SIZE,
        quality: AVATAR_QUALITY,
      });
      console.info(
        `Image compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(compressedFile.size / 1024).toFixed(1)}KB`,
      );

      localUrl = URL.createObjectURL(compressedFile);
      setOptimisticImage(localUrl);

      const formData = new FormData();
      formData.append('avatar', compressedFile);

      const response = await fetch(`${API_BASE}/api/users/avatar`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Upload failed');
      }

      const { url } = await response.json();
      await auth.updateProfile({ image: url });
      syncProfileToProjects();
      setOptimisticImage(null);
      showToast.success('Photo Updated', 'Your profile photo has been updated.');
    } catch (err) {
      setOptimisticImage(null);
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, { toastTitle: 'Upload Failed' });
    } finally {
      setUploadingImage(false);
      // Revoke object URL to prevent memory leak
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
      // Reset file input so same file can be selected again
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef?.click();
  };

  return (
    <div class='space-y-6'>
      {/* Avatar and Name Row */}
      <div class='flex items-center gap-6'>
        {/* Avatar */}
        <div class='group relative shrink-0'>
          <Show
            when={avatarUrl()}
            fallback={
              <div class='flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xl font-semibold text-white shadow-md'>
                {userInitials()}
              </div>
            }
          >
            <img
              src={avatarUrl()}
              alt={user()?.name || 'Profile'}
              class='h-20 w-20 rounded-full object-cover shadow-md ring-2 ring-white'
              referrerPolicy='no-referrer'
            />
          </Show>
          <button
            onClick={triggerFileSelect}
            disabled={uploadingImage()}
            class='absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-slate-900/60 opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 disabled:cursor-wait'
            title='Change profile photo'
          >
            <Show
              when={!uploadingImage()}
              fallback={
                <div class='h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent' />
              }
            >
              <FiCamera class='h-5 w-5 text-white' />
            </Show>
          </button>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/jpeg,image/png,image/gif,image/webp'
            class='hidden'
            onChange={handleImageSelect}
          />
        </div>

        {/* Name Fields - Inline Editable */}
        <div class='min-w-0 flex-1'>
          <div class='grid grid-cols-2 gap-4'>
            <div>
              <label class='mb-1 block text-xs font-medium tracking-wide text-slate-400 uppercase'>
                First Name
              </label>
              <SimpleEditable
                activationMode='click'
                value={firstName() || 'Add first name'}
                onSubmit={handleFirstNameChange}
                showEditIcon={true}
                placeholder='First name'
                class='text-lg font-medium text-slate-900'
              />
            </div>
            <div>
              <label class='mb-1 block text-xs font-medium tracking-wide text-slate-400 uppercase'>
                Last Name
              </label>
              <SimpleEditable
                activationMode='click'
                value={lastName() || 'Add last name'}
                onSubmit={handleLastNameChange}
                showEditIcon={true}
                placeholder='Last name'
                class='text-lg font-medium text-slate-900'
              />
            </div>
          </div>
          <div class='mt-3 flex items-center gap-2'>
            <p class='text-sm text-slate-500'>{user()?.email}</p>
            <Show when={user()?.emailVerified}>
              <span class='inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/10'>
                <FiCheck class='h-3 w-3' />
                Verified
              </span>
            </Show>
          </div>
        </div>
      </div>

      {/* Member Since */}
      <div class='border-t border-slate-100 pt-5'>
        <label class='mb-1 block text-xs font-medium tracking-wide text-slate-400 uppercase'>
          Member Since
        </label>
        <p class='text-slate-900'>{formatDate(user()?.createdAt)}</p>
      </div>
    </div>
  );
}
