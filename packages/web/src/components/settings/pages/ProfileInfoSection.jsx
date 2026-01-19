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

  // Use structured givenName/familyName if available, fallback to splitting name
  const firstName = () => {
    const u = user();
    if (u?.givenName) return u.givenName;
    const name = u?.name || '';
    return name.split(' ')[0] || '';
  };

  const lastName = () => {
    const u = user();
    if (u?.familyName) return u.familyName;
    const name = u?.name || '';
    return name.split(' ').slice(1).join(' ') || '';
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
    const givenName = newFirstName?.trim() || '';
    if (givenName === firstName()) return;

    const familyName = lastName();
    const fullName = [givenName, familyName].filter(Boolean).join(' ');
    try {
      await auth.updateProfile({
        name: fullName,
        givenName: givenName || null,
        familyName: familyName || null,
      });
      syncProfileToProjects();
    } catch (err) {
      console.warn('Failed to update first name:', err.message);
      showToast.error('Update Failed', 'Failed to update name. Please try again.');
    }
  };

  const handleLastNameChange = async newLastName => {
    const familyName = newLastName?.trim() || '';
    if (familyName === lastName()) return;

    const givenName = firstName();
    const fullName = [givenName, familyName].filter(Boolean).join(' ');
    try {
      await auth.updateProfile({
        name: fullName,
        givenName: givenName || null,
        familyName: familyName || null,
      });
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
              <div class='from-primary to-primary/80 text-primary-foreground flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br text-xl font-semibold shadow-md'>
                {userInitials()}
              </div>
            }
          >
            <img
              src={avatarUrl()}
              alt={user()?.name || 'Profile'}
              class='ring-background h-20 w-20 rounded-full object-cover shadow-md ring-2'
              referrerPolicy='no-referrer'
            />
          </Show>
          <button
            onClick={triggerFileSelect}
            disabled={uploadingImage()}
            class='bg-foreground/60 absolute inset-0 flex cursor-pointer items-center justify-center rounded-full opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 disabled:cursor-wait'
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
              <label class='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>
                First Name
              </label>
              <SimpleEditable
                activationMode='click'
                value={firstName() || 'Add first name'}
                onSubmit={handleFirstNameChange}
                showEditIcon={true}
                placeholder='First name'
                class='text-foreground text-lg font-medium'
              />
            </div>
            <div>
              <label class='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>
                Last Name
              </label>
              <SimpleEditable
                activationMode='click'
                value={lastName() || 'Add last name'}
                onSubmit={handleLastNameChange}
                showEditIcon={true}
                placeholder='Last name'
                class='text-foreground text-lg font-medium'
              />
            </div>
          </div>
          <div class='mt-3 flex items-center gap-2'>
            <p class='text-muted-foreground text-sm'>{user()?.email}</p>
            <Show when={user()?.emailVerified}>
              <span class='bg-success-subtle text-success ring-success/10 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ring-1'>
                <FiCheck class='h-3 w-3' />
                Verified
              </span>
            </Show>
          </div>
        </div>
      </div>

      {/* Member Since */}
      <div class='border-border-subtle border-t pt-5'>
        <label class='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>
          Member Since
        </label>
        <p class='text-foreground'>{formatDate(user()?.createdAt)}</p>
      </div>
    </div>
  );
}
