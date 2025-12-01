import { createSignal, Show } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { FiUser, FiMail, FiCalendar, FiEdit2, FiCheck, FiX, FiAlertTriangle } from 'solid-icons/fi';
import { showToast } from '@components/zag/Toast.jsx';
import { LANDING_URL } from '@config/api.js';

export default function ProfilePage() {
  const auth = useBetterAuth();
  const user = () => auth.user();
  const [isEditing, setIsEditing] = createSignal(false);
  const [editName, setEditName] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [deleteConfirmText, setDeleteConfirmText] = createSignal('');
  const [deletingAccount, setDeletingAccount] = createSignal(false);

  const startEditing = () => {
    setEditName(user()?.name || '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName('');
  };

  const saveProfile = async () => {
    setSaving(true);

    try {
      // TODO: Implement profile update API call
      // For now, just simulate a save
      await new Promise(resolve => setTimeout(resolve, 500));
      showToast.success('Profile Updated', 'Your profile has been updated successfully.');
      setIsEditing(false);
    } catch {
      showToast.error('Update Failed', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
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
    <div class='max-w-2xl mx-auto p-6'>
      <h1 class='text-2xl font-bold text-gray-900 mb-6'>Profile</h1>

      <div class='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
        {/* Profile Header */}
        <div class='bg-linear-to-r from-blue-600 to-blue-500 px-6 py-8'>
          <div class='flex items-center space-x-4'>
            <div class='w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-white text-3xl font-bold'>
              {user()?.name?.charAt(0).toUpperCase() ||
                user()?.email?.charAt(0).toUpperCase() ||
                'U'}
            </div>
            <div class='text-white'>
              <h2 class='text-xl font-semibold'>{user()?.name || 'User'}</h2>
              <p class='text-blue-100'>{user()?.email}</p>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div class='p-6 space-y-6'>
          {/* Name Field */}
          <div class='flex items-start justify-between'>
            <div class='flex items-start space-x-3'>
              <FiUser class='w-5 h-5 text-gray-400 mt-0.5' />
              <div>
                <label class='block text-sm font-medium text-gray-500'>Name</label>
                <Show
                  when={isEditing()}
                  fallback={<p class='text-gray-900'>{user()?.name || 'Not set'}</p>}
                >
                  <input
                    type='text'
                    value={editName()}
                    onInput={e => setEditName(e.target.value)}
                    class='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
                    placeholder='Enter your name'
                  />
                </Show>
              </div>
            </div>
            <Show
              when={isEditing()}
              fallback={
                <button
                  onClick={startEditing}
                  class='text-blue-600 hover:text-blue-700 p-1 rounded'
                  title='Edit name'
                >
                  <FiEdit2 class='w-4 h-4' />
                </button>
              }
            >
              <div class='flex space-x-2'>
                <button
                  onClick={saveProfile}
                  disabled={saving()}
                  class='text-green-600 hover:text-green-700 p-1 rounded disabled:opacity-50'
                  title='Save'
                >
                  <FiCheck class='w-4 h-4' />
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={saving()}
                  class='text-red-600 hover:text-red-700 p-1 rounded disabled:opacity-50'
                  title='Cancel'
                >
                  <FiX class='w-4 h-4' />
                </button>
              </div>
            </Show>
          </div>

          {/* Email Field */}
          <div class='flex items-start space-x-3'>
            <FiMail class='w-5 h-5 text-gray-400 mt-0.5' />
            <div>
              <label class='block text-sm font-medium text-gray-500'>Email</label>
              <p class='text-gray-900'>{user()?.email || 'Not set'}</p>
              <Show when={user()?.emailVerified}>
                <span class='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-1'>
                  Verified
                </span>
              </Show>
            </div>
          </div>

          {/* Account Created */}
          <div class='flex items-start space-x-3'>
            <FiCalendar class='w-5 h-5 text-gray-400 mt-0.5' />
            <div>
              <label class='block text-sm font-medium text-gray-500'>Member since</label>
              <p class='text-gray-900'>{formatDate(user()?.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <Show when={user()}>
        <div class='mt-8 bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden'>
          <div class='px-6 py-4 border-b border-red-200 bg-red-50'>
            <div class='flex items-center space-x-2'>
              <FiAlertTriangle class='w-5 h-5 text-red-600' />
              <h3 class='text-lg font-medium text-red-800'>Danger Zone</h3>
            </div>
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
                    class='px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition'
                  >
                    Delete Account
                  </button>
                </div>
              }
            >
              <div class='space-y-4'>
                <div class='p-4 bg-red-50 border border-red-200 rounded-md'>
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
                    class='block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 text-sm'
                    placeholder='DELETE'
                  />
                </div>

                <div class='flex space-x-3'>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount() || deleteConfirmText() !== 'DELETE'}
                    class='px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {deletingAccount() ? 'Deleting...' : 'Permanently Delete Account'}
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    class='px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition'
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
  );
}
