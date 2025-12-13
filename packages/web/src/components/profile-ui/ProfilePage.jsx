import { createSignal, Show, For } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { FiCamera } from 'solid-icons/fi';
import { showToast } from '@components/zag/Toast.jsx';
import { LANDING_URL, API_BASE } from '@config/api.js';
import { ROLES, getRoleLabel } from '@components/auth-ui/RoleSelector.jsx';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Avatar compression settings
const AVATAR_MAX_SIZE = 256; // Max width/height in pixels
const AVATAR_QUALITY = 0.85; // JPEG quality (0-1)

/**
 * Compress and resize an image file for avatar use
 * Returns a new File object with the compressed image
 */
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate new dimensions (maintain aspect ratio, fit within max size)
      let { width, height } = img;

      if (width > height) {
        if (width > AVATAR_MAX_SIZE) {
          height = Math.round((height * AVATAR_MAX_SIZE) / width);
          width = AVATAR_MAX_SIZE;
        }
      } else {
        if (height > AVATAR_MAX_SIZE) {
          width = Math.round((width * AVATAR_MAX_SIZE) / height);
          height = AVATAR_MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        blob => {
          if (blob) {
            // Create a new File from the blob
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        AVATAR_QUALITY,
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    // Load the image from file
    img.src = URL.createObjectURL(file);
  });
}

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

  // Get avatar URL - use optimistic image if available, otherwise user's image
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
      const compressedFile = await compressImage(file);
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
      console.error('Avatar upload error:', err);
      // Revert optimistic update on error
      setOptimisticImage(null);
      showToast.error(
        'Upload Failed',
        err.message || 'Failed to update profile photo. Please try again.',
      );
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
      showToast.error(
        'Delete Failed',
        err.message || 'Failed to delete account. Please try again.',
      );
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
      <div class='max-w-2xl mx-auto space-y-6'>
        {/* Header */}
        <div>
          <h1 class='text-2xl font-bold text-gray-900'>Profile</h1>
          <p class='text-gray-500 mt-1'>Manage your account settings</p>
        </div>

        {/* Profile Card */}
        <div class='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
          {/* Avatar and Name Row */}
          <div class='flex items-center space-x-4 pb-6 border-b border-gray-100'>
            {/* Profile Image or Initials with Edit Button */}
            <div class='relative group'>
              <Show
                when={avatarUrl()}
                fallback={
                  <div class='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold'>
                    {userInitials()}
                  </div>
                }
              >
                <img
                  src={avatarUrl()}
                  alt={user()?.name || 'Profile'}
                  class='w-16 h-16 rounded-full object-cover ring-2 ring-gray-100'
                  referrerPolicy='no-referrer'
                />
              </Show>
              {/* Edit overlay button */}
              <button
                onClick={triggerFileSelect}
                disabled={uploadingImage()}
                class='absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait'
                title='Change profile photo'
              >
                <Show
                  when={!uploadingImage()}
                  fallback={
                    <div class='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                  }
                >
                  <FiCamera class='w-5 h-5 text-white' />
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
                <span class='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 mt-1'>
                  {getRoleLabel(user()?.persona)}
                </span>
              </Show>
            </div>
          </div>

          {/* Profile Fields */}
          <div class='pt-6 space-y-5'>
            {/* Name Field */}
            <div class='flex items-start justify-between'>
              <div class='flex-1'>
                <Show
                  when={isEditingName()}
                  fallback={
                    <div class='grid grid-cols-2 gap-4'>
                      <div>
                        <label class='block text-xs font-medium text-gray-500 uppercase tracking-wide'>
                          First Name
                        </label>
                        <p class='mt-1 text-gray-900'>{firstName() || 'Not set'}</p>
                      </div>
                      <div>
                        <label class='block text-xs font-medium text-gray-500 uppercase tracking-wide'>
                          Last Name
                        </label>
                        <p class='mt-1 text-gray-900'>{lastName() || 'Not set'}</p>
                      </div>
                    </div>
                  }
                >
                  <div class='grid grid-cols-2 gap-4'>
                    <div>
                      <label class='block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1'>
                        First Name
                      </label>
                      <input
                        type='text'
                        value={editFirstName()}
                        onInput={e => setEditFirstName(e.target.value)}
                        class='block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm'
                        placeholder='First name'
                      />
                    </div>
                    <div>
                      <label class='block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1'>
                        Last Name
                      </label>
                      <input
                        type='text'
                        value={editLastName()}
                        onInput={e => setEditLastName(e.target.value)}
                        class='block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm'
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
                    class='text-blue-600 hover:text-blue-700 text-sm font-medium ml-4'
                  >
                    Edit
                  </button>
                }
              >
                <div class='flex space-x-2 ml-4'>
                  <button
                    onClick={saveName}
                    disabled={saving()}
                    class='px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50'
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditingName}
                    disabled={saving()}
                    class='px-3 py-1 text-gray-600 text-sm font-medium hover:text-gray-800 disabled:opacity-50'
                  >
                    Cancel
                  </button>
                </div>
              </Show>
            </div>

            {/* Persona Field */}
            <div class='flex items-start justify-between pt-4 border-t border-gray-100'>
              <div class='flex-1'>
                <label class='block text-xs font-medium text-gray-500 uppercase tracking-wide'>
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
                    class='mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm'
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
                    class='text-blue-600 hover:text-blue-700 text-sm font-medium ml-4'
                  >
                    Edit
                  </button>
                }
              >
                <div class='flex space-x-2 ml-4'>
                  <button
                    onClick={saveRole}
                    disabled={saving()}
                    class='px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50'
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditingRole}
                    disabled={saving()}
                    class='px-3 py-1 text-gray-600 text-sm font-medium hover:text-gray-800 disabled:opacity-50'
                  >
                    Cancel
                  </button>
                </div>
              </Show>
            </div>

            {/* Email Field */}
            <div class='pt-4 border-t border-gray-100'>
              <label class='block text-xs font-medium text-gray-500 uppercase tracking-wide'>
                Email
              </label>
              <div class='mt-1 flex items-center space-x-2'>
                <p class='text-gray-900'>{user()?.email || 'Not set'}</p>
                <Show when={user()?.emailVerified}>
                  <span class='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700'>
                    Verified
                  </span>
                </Show>
              </div>
            </div>

            {/* Member Since */}
            <div class='pt-4 border-t border-gray-100'>
              <label class='block text-xs font-medium text-gray-500 uppercase tracking-wide'>
                Member since
              </label>
              <p class='mt-1 text-gray-900'>{formatDate(user()?.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <Show when={user()}>
          <div class='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
            <div class='px-6 py-4 border-b border-gray-200'>
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
                      class='px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition'
                    >
                      Delete Account
                    </button>
                  </div>
                }
              >
                <div class='space-y-4'>
                  <div class='p-4 bg-red-50 border border-red-200 rounded-lg'>
                    <p class='text-sm text-red-800 font-medium mb-2'>
                      Are you sure you want to delete your account?
                    </p>
                    <ul class='text-sm text-red-700 list-disc list-inside space-y-1'>
                      <li>All your projects will be permanently deleted</li>
                      <li>All your checklists and reviews will be lost</li>
                      <li>You will be removed from all shared projects</li>
                      <li>This action cannot be undone</li>
                    </ul>
                  </div>

                  <div>
                    <label class='block text-sm font-medium text-gray-700 mb-1'>
                      Type <span class='font-mono font-bold'>DELETE</span> to confirm
                    </label>
                    <input
                      type='text'
                      value={deleteConfirmText()}
                      onInput={e => setDeleteConfirmText(e.target.value)}
                      class='block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm'
                      placeholder='DELETE'
                    />
                  </div>

                  <div class='flex space-x-3'>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deletingAccount() || deleteConfirmText() !== 'DELETE'}
                      class='px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {deletingAccount() ? 'Deleting...' : 'Permanently Delete Account'}
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                      class='px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition'
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
