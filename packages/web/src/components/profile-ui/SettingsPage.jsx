import { createSignal, Show } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { FiBell, FiMoon, FiShield, FiKey, FiEye, FiEyeOff } from 'solid-icons/fi';
import { LANDING_URL } from '@config/api.js';
import Switch from '@components/zag/Switch.jsx';

export default function SettingsPage() {
  const { user } = useBetterAuth();

  // Notification settings
  const [emailNotifications, setEmailNotifications] = createSignal(true);
  const [projectUpdates, setProjectUpdates] = createSignal(true);

  // Appearance settings
  const [darkMode, setDarkMode] = createSignal(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = createSignal(false);
  const [currentPassword, setCurrentPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [showCurrentPassword, setShowCurrentPassword] = createSignal(false);
  const [showNewPassword, setShowNewPassword] = createSignal(false);
  const [passwordError, setPasswordError] = createSignal('');
  const [passwordSuccess, setPasswordSuccess] = createSignal('');
  const [changingPassword, setChangingPassword] = createSignal(false);

  const handlePasswordChange = async e => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword() !== confirmPassword()) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword().length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    setChangingPassword(true);

    try {
      // TODO: Implement password change API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setPasswordSuccess('Password changed successfully!');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError('Failed to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div class='max-w-2xl mx-auto p-6'>
      <h1 class='text-2xl font-bold text-gray-900 mb-6'>Settings</h1>

      {/* Notifications Section */}
      <div class='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6'>
        <div class='px-6 py-4 border-b border-gray-200 bg-gray-50'>
          <div class='flex items-center space-x-2'>
            <FiBell class='w-5 h-5 text-gray-600' />
            <h2 class='text-lg font-medium text-gray-900'>Notifications</h2>
          </div>
        </div>
        <div class='p-6 space-y-4'>
          <div class='flex items-center justify-between'>
            <div>
              <p class='font-medium text-gray-900'>Email Notifications</p>
              <p class='text-sm text-gray-500'>Receive email notifications about your account.</p>
            </div>
            <Switch checked={emailNotifications()} onChange={setEmailNotifications} />
          </div>
          <div class='flex items-center justify-between'>
            <div>
              <p class='font-medium text-gray-900'>Project Updates</p>
              <p class='text-sm text-gray-500'>
                Get notified when collaborators make changes to your projects.
              </p>
            </div>
            <Switch checked={projectUpdates()} onChange={setProjectUpdates} />
          </div>
        </div>
      </div>

      {/* Appearance Section */}
      <div class='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6'>
        <div class='px-6 py-4 border-b border-gray-200 bg-gray-50'>
          <div class='flex items-center space-x-2'>
            <FiMoon class='w-5 h-5 text-gray-600' />
            <h2 class='text-lg font-medium text-gray-900'>Appearance</h2>
          </div>
        </div>
        <div class='p-6'>
          <div class='flex items-center justify-between'>
            <div>
              <p class='font-medium text-gray-900'>Dark Mode</p>
              <p class='text-sm text-gray-500'>Use dark theme across the application.</p>
            </div>
            <Switch checked={darkMode()} onChange={setDarkMode} />
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div class='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6'>
        <div class='px-6 py-4 border-b border-gray-200 bg-gray-50'>
          <div class='flex items-center space-x-2'>
            <FiShield class='w-5 h-5 text-gray-600' />
            <h2 class='text-lg font-medium text-gray-900'>Security</h2>
          </div>
        </div>
        <div class='p-6'>
          <Show when={passwordSuccess()}>
            <div class='mb-4 p-3 rounded-md text-sm bg-green-50 text-green-700 border border-green-200'>
              {passwordSuccess()}
            </div>
          </Show>

          <Show
            when={showPasswordForm()}
            fallback={
              <div class='flex items-center justify-between'>
                <div>
                  <p class='font-medium text-gray-900'>Change Password</p>
                  <p class='text-sm text-gray-500'>
                    Update your password to keep your account secure.
                  </p>
                </div>
                <button
                  onClick={() => setShowPasswordForm(true)}
                  class='flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition'
                >
                  <FiKey class='w-4 h-4' />
                  <span>Change Password</span>
                </button>
              </div>
            }
          >
            <form onSubmit={handlePasswordChange} class='space-y-4'>
              <Show when={passwordError()}>
                <div class='p-3 rounded-md text-sm bg-red-50 text-red-700 border border-red-200'>
                  {passwordError()}
                </div>
              </Show>

              <div>
                <label class='block text-sm font-medium text-gray-700 mb-1'>Current Password</label>
                <div class='relative'>
                  <input
                    type={showCurrentPassword() ? 'text' : 'password'}
                    value={currentPassword()}
                    onInput={e => setCurrentPassword(e.target.value)}
                    class='block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
                    required
                  />
                  <button
                    type='button'
                    onClick={() => setShowCurrentPassword(!showCurrentPassword())}
                    class='absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600'
                  >
                    <Show when={showCurrentPassword()} fallback={<FiEye class='w-4 h-4' />}>
                      <FiEyeOff class='w-4 h-4' />
                    </Show>
                  </button>
                </div>
              </div>

              <div>
                <label class='block text-sm font-medium text-gray-700 mb-1'>New Password</label>
                <div class='relative'>
                  <input
                    type={showNewPassword() ? 'text' : 'password'}
                    value={newPassword()}
                    onInput={e => setNewPassword(e.target.value)}
                    class='block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
                    required
                  />
                  <button
                    type='button'
                    onClick={() => setShowNewPassword(!showNewPassword())}
                    class='absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600'
                  >
                    <Show when={showNewPassword()} fallback={<FiEye class='w-4 h-4' />}>
                      <FiEyeOff class='w-4 h-4' />
                    </Show>
                  </button>
                </div>
              </div>

              <div>
                <label class='block text-sm font-medium text-gray-700 mb-1'>
                  Confirm New Password
                </label>
                <input
                  type='password'
                  value={confirmPassword()}
                  onInput={e => setConfirmPassword(e.target.value)}
                  class='block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
                  required
                />
              </div>

              <div class='flex space-x-3'>
                <button
                  type='submit'
                  disabled={changingPassword()}
                  class='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition disabled:opacity-50'
                >
                  {changingPassword() ? 'Changing...' : 'Update Password'}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordError('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  class='px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition'
                >
                  Cancel
                </button>
              </div>
            </form>
          </Show>
        </div>
      </div>

      {/* About Section */}
      <div class='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
        <div class='px-6 py-4 border-b border-gray-200 bg-gray-50'>
          <h2 class='text-lg font-medium text-gray-900'>About</h2>
        </div>
        <div class='p-6'>
          <div class='space-y-2 text-sm text-gray-600'>
            <p>
              <span class='font-medium text-gray-900'>CoRATES</span> - Collaborative Review
              Assessment Tool for Evidence Synthesis
            </p>
            <p>Version 1.0.0</p>
            <p class='pt-2'>
              <a href={LANDING_URL} class='text-blue-600 hover:underline'>
                Visit our website
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
