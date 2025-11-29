import { createSignal, Show } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { FiUser, FiMail, FiCalendar, FiEdit2, FiCheck, FiX } from 'solid-icons/fi';

export default function ProfilePage() {
  const { user } = useBetterAuth();
  const [isEditing, setIsEditing] = createSignal(false);
  const [editName, setEditName] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [message, setMessage] = createSignal(null);

  const startEditing = () => {
    setEditName(user()?.name || '');
    setIsEditing(true);
    setMessage(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName('');
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // TODO: Implement profile update API call
      // For now, just simulate a save
      await new Promise(resolve => setTimeout(resolve, 500));
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
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

      <Show when={message()}>
        <div
          class={`mb-4 p-3 rounded-md text-sm ${
            message().type === 'success' ?
              'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message().text}
        </div>
      </Show>

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
      <div class='mt-8 bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden'>
        <div class='px-6 py-4 border-b border-red-200 bg-red-50'>
          <h3 class='text-lg font-medium text-red-800'>Danger Zone</h3>
        </div>
        <div class='p-6'>
          <div class='flex items-center justify-between'>
            <div>
              <p class='font-medium text-gray-900'>Delete Account</p>
              <p class='text-sm text-gray-500'>
                Permanently delete your account and all associated data.
              </p>
            </div>
            <button class='px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition'>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
