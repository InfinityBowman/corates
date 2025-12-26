import { createSignal, Show, For } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { FiCamera } from 'solid-icons/fi';
import { showToast } from '@corates/ui';
import { LANDING_URL, API_BASE } from '@config/api.js';
import { ROLES, getRoleLabel } from '@components/auth-ui/RoleSelector.jsx';
import { compressImageFile } from '@lib/imageUtils.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Avatar compression settings
const AVATAR_MAX_SIZE = 256; // Max width/height in pixels
const AVATAR_QUALITY = 0.85; // JPEG quality (0-1)

/**
 * Sync profile changes to all projects the user is a member of
 * This updates the Y.js documents so other project members see the changes
 */
async function syncProfileToProjects() {
  try {
    await fetch(`${API_BASE}/api/users/sync-profile`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    // Silently fail - this is a background sync operation
    console.error('Failed to sync profile to projects:', err);
  }
}

export default function ProfilePage() {
  const auth = useBetterAuth();
  const user = () => auth.user();

  // Editing state
  const [isEditingName, setIsEditingName] = createSignal(false);
  const [isEditingRole, setIsEditingRole] = createSignal(false);
  const [editFirstName, setEditFirstName] = createSignal('');
  const [editLastName, setEditLastName] = createSignal('');
  const [editRole, setEditRole] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [deleteConfirmText, setDeleteConfirmText] = createSignal('');
  const [deletingAccount, setDeletingAccount] = createSignal(false);

  // Profile picture state
  const [uploadingImage, setUploadingImage] = createSignal(false);
  const [optimisticImage, setOptimisticImage] = createSignal(null);
  let fileInputRef;

  // Get avatar URL - use optimistic image if available, otherwise user's image (which includes cached)
  const avatarUrl = () => optimisticImage() || user()?.image || null;

  // Parse name into first/last
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

  const startEditingName = () => {
    setEditFirstName(firstName());
    setEditLastName(lastName());
    setIsEditingName(true);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setEditFirstName('');
    setEditLastName('');
  };

  const startEditingRole = () => {
    setEditRole(user()?.persona || '');
    setIsEditingRole(true);
  };

  const cancelEditingRole = () => {
    setIsEditingRole(false);
    setEditRole('');
  };

  const saveName = async () => {
    setSaving(true);

    try {
      const fullName = `${editFirstName().trim()} ${editLastName().trim()}`.trim();
      await auth.updateProfile({
        name: fullName,
      });
      // Sync to all projects in background
      syncProfileToProjects();
      showToast.success('Profile Updated', 'Your name has been updated successfully.');
      setIsEditingName(false);
    } catch {
      showToast.error('Update Failed', 'Failed to update name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveRole = async () => {
    setSaving(true);

    try {
      await auth.updateProfile({
        persona: editRole() || null,
      });
      showToast.success('Profile Updated', 'Your persona has been updated successfully.');
      setIsEditingRole(false);
    } catch {
      showToast.error('Update Failed', 'Failed to update persona. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelect = async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast.error('Invalid File', 'Please select a JPEG, PNG, GIF, or WebP image.');
      return;
    }

    // Note: We don't check file size here since we compress before upload
    // The compression will reduce even large files to ~10-50KB

    setUploadingImage(true);

    try {
      // Compress the image before upload
      const compressedFile = await compressImageFile(file, {
        maxSize: AVATAR_MAX_SIZE,
        quality: AVATAR_QUALITY,
      });
      console.log(
        `Image compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(compressedFile.size / 1024).toFixed(1)}KB`,
      );

      // Optimistically show the compressed image immediately
      const localUrl = URL.createObjectURL(compressedFile);
      setOptimisticImage(localUrl);

      // Upload to R2 via API
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

      // Update user profile with the new avatar URL
      await auth.updateProfile({
        image: url,
      });

      // Sync to all projects in background
      syncProfileToProjects();

      // Clear optimistic image now that server has the real one
      setOptimisticImage(null);

      showToast.success('Photo Updated', 'Your profile photo has been updated.');
    } catch (err) {
      // Revert optimistic update on error
      setOptimisticImage(null);
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        toastTitle: 'Upload Failed',
      });
    } finally {
      setUploadingImage(false);
    }

    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const triggerFileSelect = () => {
    fileInputRef?.click();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText() !== 'DELETE') {
      showToast.error('Confirmation Required', 'Please type DELETE to confirm.');
      return;
    }

    setDeletingAccount(true);

    try {
      await auth.deleteAccount();
      showToast.success('Account Deleted', 'Your account has been deleted.');
      // Redirect to landing page after successful deletion
      window.location.href = LANDING_URL;
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        toastTitle: 'Delete Failed',
      });
      setDeletingAccount(false);
    }
  };

  const formatDate = dateString => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div class='p-6'>
      <div class='mx-auto max-w-2xl space-y-6'>
        {/* Header */}
        <div>
          <h1 class='text-2xl font-bold text-gray-900'>Profile</h1>
          <p class='mt-1 text-gray-500'>Manage your account settings</p>
        </div>

        {/* Profile Card */}
        <div class='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
          {/* Avatar and Name Row */}
          <div class='flex items-center space-x-4 border-b border-gray-100 pb-6'>
            {/* Profile Image or Initials with Edit Button */}
            <div class='group relative'>
              <Show
                when={avatarUrl()}
                fallback={
                  <div class='flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600'>
                    {userInitials()}
                  </div>
                }
              >
                <img
                  src={avatarUrl()}
                  alt={user()?.name || 'Profile'}
                  class='h-16 w-16 rounded-full object-cover ring-2 ring-gray-100'
                  referrerPolicy='no-referrer'
                />
              </Show>
              {/* Edit overlay button */}
              <button
                onClick={triggerFileSelect}
                disabled={uploadingImage()}
                class='absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-wait'
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
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type='file'
                accept='image/jpeg,image/png,image/gif,image/webp'
                class='hidden'
                onChange={handleImageSelect}
              />
            </div>
            <div>
              <h2 class='text-lg font-semibold text-gray-900'>{user()?.name || 'User'}</h2>
              <p class='text-sm text-gray-500'>{user()?.email}</p>
              <Show when={user()?.persona}>
                <span class='mt-1 inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700'>
                  {getRoleLabel(user()?.persona)}
                </span>
              </Show>
            </div>
          </div>

          {/* Profile Fields */}
          <div class='space-y-5 pt-6'>
            {/* Name Field */}
            <div class='flex items-start justify-between'>
              <div class='flex-1'>
                <Show
                  when={isEditingName()}
                  fallback={
                    <div class='grid grid-cols-2 gap-4'>
                      <div>
                        <label class='block text-xs font-medium tracking-wide text-gray-500 uppercase'>
                          First Name
                        </label>
                        <p class='mt-1 text-gray-900'>{firstName() || 'Not set'}</p>
                      </div>
                      <div>
                        <label class='block text-xs font-medium tracking-wide text-gray-500 uppercase'>
                          Last Name
                        </label>
                        <p class='mt-1 text-gray-900'>{lastName() || 'Not set'}</p>
                      </div>
                    </div>
                  }
                >
                  <div class='grid grid-cols-2 gap-4'>
                    <div>
                      <label class='mb-1 block text-xs font-medium tracking-wide text-gray-500 uppercase'>
                        First Name
                      </label>
                      <input
                        type='text'
                        value={editFirstName()}
                        onInput={e => setEditFirstName(e.target.value)}
                        class='block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
                        placeholder='First name'
                      />
                    </div>
                    <div>
                      <label class='mb-1 block text-xs font-medium tracking-wide text-gray-500 uppercase'>
                        Last Name
                      </label>
                      <input
                        type='text'
                        value={editLastName()}
                        onInput={e => setEditLastName(e.target.value)}
                        class='block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
                        placeholder='Last name'
                      />
                    </div>
                  </div>
                </Show>
              </div>
              <Show
                when={isEditingName()}
                fallback={
                  <button
                    onClick={startEditingName}
                    class='ml-4 text-sm font-medium text-blue-600 hover:text-blue-700'
                  >
                    Edit
                  </button>
                }
              >
                <div class='ml-4 flex space-x-2'>
                  <button
                    onClick={saveName}
                    disabled={saving()}
                    class='rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50'
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditingName}
                    disabled={saving()}
                    class='px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50'
                  >
                    Cancel
                  </button>
                </div>
              </Show>
            </div>

            {/* Persona Field */}
            <div class='flex items-start justify-between border-t border-gray-100 pt-4'>
              <div class='flex-1'>
                <label class='block text-xs font-medium tracking-wide text-gray-500 uppercase'>
                  Persona
                </label>
                <Show
                  when={isEditingRole()}
                  fallback={
                    <p class='mt-1 text-gray-900'>{getRoleLabel(user()?.persona) || 'Not set'}</p>
                  }
                >
                  <select
                    value={editRole()}
                    onChange={e => setEditRole(e.target.value)}
                    class='mt-1 block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-400 focus:outline-none'
                  >
                    <option value=''>Select a persona</option>
                    <For each={ROLES}>{role => <option value={role.id}>{role.label}</option>}</For>
                  </select>
                </Show>
              </div>
              <Show
                when={isEditingRole()}
                fallback={
                  <button
                    onClick={startEditingRole}
                    class='ml-4 text-sm font-medium text-blue-600 hover:text-blue-700'
                  >
                    Edit
                  </button>
                }
              >
                <div class='ml-4 flex space-x-2'>
                  <button
                    onClick={saveRole}
                    disabled={saving()}
                    class='rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50'
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditingRole}
                    disabled={saving()}
                    class='px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50'
                  >
                    Cancel
                  </button>
                </div>
              </Show>
            </div>

            {/* Email Field */}
            <div class='border-t border-gray-100 pt-4'>
              <label class='block text-xs font-medium tracking-wide text-gray-500 uppercase'>
                Email
              </label>
              <div class='mt-1 flex items-center space-x-2'>
                <p class='text-gray-900'>{user()?.email || 'Not set'}</p>
                <Show when={user()?.emailVerified}>
                  <span class='inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'>
                    Verified
                  </span>
                </Show>
              </div>
            </div>

            {/* Member Since */}
            <div class='border-t border-gray-100 pt-4'>
              <label class='block text-xs font-medium tracking-wide text-gray-500 uppercase'>
                Member since
              </label>
              <p class='mt-1 text-gray-900'>{formatDate(user()?.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <Show when={user()}>
          <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
            <div class='border-b border-gray-200 px-6 py-4'>
              <h3 class='text-base font-semibold text-gray-900'>Danger Zone</h3>
            </div>
            <div class='p-6'>
              <Show
                when={showDeleteConfirm()}
                fallback={
                  <div class='flex items-center justify-between'>
                    <div>
                      <p class='font-medium text-gray-900'>Delete Account</p>
                      <p class='text-sm text-gray-500'>
                        Permanently delete your account and all associated data.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      class='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    >
                      Delete Account
                    </button>
                  </div>
                }
              >
                <div class='space-y-4'>
                  <div class='rounded-lg border border-red-200 bg-red-50 p-4'>
                    <p class='mb-2 text-sm font-medium text-red-800'>
                      Are you sure you want to delete your account?
                    </p>
                    <ul class='list-inside list-disc space-y-1 text-sm text-red-700'>
                      <li>All your projects will be permanently deleted</li>
                      <li>All your checklists and reviews will be lost</li>
                      <li>You will be removed from all shared projects</li>
                      <li>This action cannot be undone</li>
                    </ul>
                  </div>

                  <div>
                    <label class='mb-1 block text-sm font-medium text-gray-700'>
                      Type <span class='font-mono font-bold'>DELETE</span> to confirm
                    </label>
                    <input
                      type='text'
                      value={deleteConfirmText()}
                      onInput={e => setDeleteConfirmText(e.target.value)}
                      class='block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
                      placeholder='DELETE'
                    />
                  </div>

                  <div class='flex space-x-3'>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deletingAccount() || deleteConfirmText() !== 'DELETE'}
                      class='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      {deletingAccount() ? 'Deleting...' : 'Permanently Delete Account'}
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                      class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200'
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
