/**
 * SecuritySettings - Security section extracted from SettingsPage
 * Includes: Add password, change password, linked accounts, 2FA
 */

import { createSignal, Show } from 'solid-js';
import { FiShield, FiKey, FiEye, FiEyeOff, FiMail, FiLink } from 'solid-icons/fi';
import { useBetterAuth } from '@api/better-auth-store.js';
import TwoFactorSetup from '@/components/settings/pages/TwoFactorSetup.jsx';
import LinkedAccountsSection from '@/components/settings/pages/LinkedAccountsSection.jsx';
import StrengthIndicator from '@/components/auth/StrengthIndicator.jsx';
import { handleError } from '@/lib/error-utils.js';

export default function SecuritySettings() {
  const { user, resetPassword, changePassword } = useBetterAuth();

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
  const [unmetRequirements, setUnmetRequirements] = createSignal([]);

  // Add password (for magic link / OAuth users)
  const [addPasswordLoading, setAddPasswordLoading] = createSignal(false);
  const [addPasswordSent, setAddPasswordSent] = createSignal(false);

  const handlePasswordChange = async e => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Check password strength requirements
    if (unmetRequirements().length > 0) {
      setPasswordError(`Password must have ${unmetRequirements().join(', ')}`);
      return;
    }

    if (newPassword() !== confirmPassword()) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);

    try {
      await changePassword(currentPassword(), newPassword());
      setPasswordSuccess('Password changed successfully!');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      await handleError(err, {
        setError: setPasswordError,
        showToast: false,
      });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div class='min-h-full bg-blue-50 py-6'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <h1 class='mb-6 text-2xl font-bold text-gray-900'>Security</h1>

        {/* Linked Accounts Section */}
        <LinkedAccountsSection />

        {/* Password & 2FA Section */}
        <div
          data-section='security'
          class='mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'
        >
          <div class='border-b border-gray-200 bg-gray-50 px-6 py-4'>
            <div class='flex items-center space-x-2'>
              <FiShield class='h-5 w-5 text-gray-600' />
              <h2 class='text-lg font-medium text-gray-900'>Password & Authentication</h2>
            </div>
          </div>
          <div class='space-y-6 p-6'>
            <Show when={passwordSuccess()}>
              <div class='rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700'>
                {passwordSuccess()}
              </div>
            </Show>

            {/* Add Password Option - for users who signed up via magic link or OAuth */}
            <Show when={addPasswordSent()}>
              <div class='rounded-lg border border-blue-200 bg-blue-50 p-4'>
                <div class='flex items-start space-x-3'>
                  <FiMail class='mt-0.5 h-5 w-5 text-blue-600' />
                  <div>
                    <p class='font-medium text-blue-900'>Check your email</p>
                    <p class='mt-1 text-sm text-blue-700'>
                      We sent a link to <strong>{user()?.email}</strong> to set your password.
                    </p>
                    <button
                      type='button'
                      onClick={() => setAddPasswordSent(false)}
                      class='mt-2 text-sm font-medium text-blue-600 hover:text-blue-800'
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={!addPasswordSent()}>
              <div class='flex items-center justify-between'>
                <div>
                  <p class='font-medium text-gray-900'>Add Password</p>
                  <p class='text-sm text-gray-500'>
                    Set a password to sign in without email links.
                  </p>
                  <p class='text-sm text-gray-500'>
                    A password is required for Two-Factor Authentication.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setAddPasswordLoading(true);
                    setPasswordError('');
                    try {
                      await resetPassword(user()?.email);
                      setAddPasswordSent(true);
                    } catch (err) {
                      console.warn('Password reset email failed:', err);
                      setPasswordError('Failed to send password setup email. Please try again.');
                    } finally {
                      setAddPasswordLoading(false);
                    }
                  }}
                  disabled={addPasswordLoading()}
                  class='flex items-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50'
                >
                  <FiMail class='h-4 w-4' />
                  <span>{addPasswordLoading() ? 'Sending...' : 'Send Setup Email'}</span>
                </button>
              </div>
            </Show>

            {/* Divider */}
            <div class='border-t border-gray-200' />

            {/* Change Password Option - for users who already have a password */}
            <Show
              when={showPasswordForm()}
              fallback={
                <div class='flex items-center justify-between'>
                  <div>
                    <p class='font-medium text-gray-900'>Change Password</p>
                    <p class='text-sm text-gray-500'>Update your existing password.</p>
                  </div>
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    class='flex items-center space-x-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200'
                  >
                    <FiKey class='h-4 w-4' />
                    <span>Change Password</span>
                  </button>
                </div>
              }
            >
              <form onSubmit={handlePasswordChange} class='space-y-4'>
                <Show when={passwordError()}>
                  <div class='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
                    {passwordError()}
                  </div>
                </Show>

                <div>
                  <label class='mb-1 block text-sm font-medium text-gray-700'>
                    Current Password
                  </label>
                  <div class='relative'>
                    <input
                      type={showCurrentPassword() ? 'text' : 'password'}
                      value={currentPassword()}
                      onInput={e => setCurrentPassword(e.target.value)}
                      class='block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none'
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowCurrentPassword(!showCurrentPassword())}
                      class='absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600'
                    >
                      <Show when={showCurrentPassword()} fallback={<FiEye class='h-4 w-4' />}>
                        <FiEyeOff class='h-4 w-4' />
                      </Show>
                    </button>
                  </div>
                </div>

                <div>
                  <label class='mb-1 block text-sm font-medium text-gray-700'>New Password</label>
                  <div class='relative'>
                    <input
                      type={showNewPassword() ? 'text' : 'password'}
                      value={newPassword()}
                      onInput={e => setNewPassword(e.target.value)}
                      class='block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none'
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowNewPassword(!showNewPassword())}
                      class='absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600'
                    >
                      <Show when={showNewPassword()} fallback={<FiEye class='h-4 w-4' />}>
                        <FiEyeOff class='h-4 w-4' />
                      </Show>
                    </button>
                  </div>
                  <StrengthIndicator password={newPassword()} onUnmet={setUnmetRequirements} />
                </div>

                <div>
                  <label class='mb-1 block text-sm font-medium text-gray-700'>
                    Confirm New Password
                  </label>
                  <input
                    type='password'
                    value={confirmPassword()}
                    onInput={e => setConfirmPassword(e.target.value)}
                    class='block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none'
                    required
                  />
                </div>

                <div class='flex space-x-3'>
                  <button
                    type='submit'
                    disabled={changingPassword()}
                    class='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50'
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
                    class='rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200'
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Show>

            {/* Divider */}
            <div class='border-t border-gray-200' />

            {/* Two-Factor Authentication */}
            <TwoFactorSetup />
          </div>
        </div>
      </div>
    </div>
  );
}
