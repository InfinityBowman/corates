/**
 * SecuritySettings - Security section extracted from SettingsPage
 * Includes: Add password, change password, linked accounts, 2FA, session management
 */

import { createSignal, Show } from 'solid-js';
import { FiShield, FiKey, FiEye, FiEyeOff, FiMail, FiMonitor } from 'solid-icons/fi';
import { useBetterAuth } from '@api/better-auth-store.js';
import TwoFactorSetup from '@/components/settings/pages/TwoFactorSetup.jsx';
import LinkedAccountsSection from '@/components/settings/pages/LinkedAccountsSection.jsx';
import SessionManagement from '@/components/settings/pages/SessionManagement.jsx';
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
    <div class='min-h-full bg-gradient-to-br from-slate-50 to-slate-100/80 py-8'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <div class='mb-8'>
          <h1 class='text-2xl font-semibold tracking-tight text-slate-900'>Security</h1>
          <p class='mt-1 text-slate-500'>Manage your account security and authentication</p>
        </div>

        {/* Linked Accounts Section */}
        <LinkedAccountsSection />

        {/* Password & 2FA Section */}
        <div
          data-section='security'
          class='mb-6 overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md'
        >
          <div class='border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50'>
                <FiShield class='h-4 w-4 text-blue-600' />
              </div>
              <h2 class='text-base font-semibold text-slate-900'>Password & Authentication</h2>
            </div>
          </div>
          <div class='space-y-6 p-6'>
            <Show when={passwordSuccess()}>
              <div class='rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700'>
                {passwordSuccess()}
              </div>
            </Show>

            {/* Add Password Option - for users who signed up via magic link or OAuth */}
            <Show when={addPasswordSent()}>
              <div class='rounded-lg border border-blue-200/60 bg-blue-50/50 p-4'>
                <div class='flex items-start space-x-3'>
                  <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100'>
                    <FiMail class='h-4 w-4 text-blue-600' />
                  </div>
                  <div>
                    <p class='font-medium text-slate-900'>Check your email</p>
                    <p class='mt-1 text-sm text-slate-600'>
                      We sent a link to <strong class='text-slate-900'>{user()?.email}</strong> to
                      set your password.
                    </p>
                    <button
                      type='button'
                      onClick={() => setAddPasswordSent(false)}
                      class='mt-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700'
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
                  <p class='font-medium text-slate-900'>Add Password</p>
                  <p class='text-sm text-slate-500'>
                    Set a password to sign in without email links.
                  </p>
                  <p class='text-sm text-slate-500'>
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
                  class='flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50'
                >
                  <FiMail class='h-4 w-4' />
                  <span>{addPasswordLoading() ? 'Sending...' : 'Send Setup Email'}</span>
                </button>
              </div>
            </Show>

            {/* Divider */}
            <div class='border-t border-slate-100' />

            {/* Change Password Option - for users who already have a password */}
            <Show
              when={showPasswordForm()}
              fallback={
                <div class='flex items-center justify-between'>
                  <div>
                    <p class='font-medium text-slate-900'>Change Password</p>
                    <p class='text-sm text-slate-500'>Update your existing password.</p>
                  </div>
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    class='flex items-center space-x-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200'
                  >
                    <FiKey class='h-4 w-4' />
                    <span>Change Password</span>
                  </button>
                </div>
              }
            >
              <form onSubmit={handlePasswordChange} class='space-y-4'>
                <Show when={passwordError()}>
                  <div class='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
                    {passwordError()}
                  </div>
                </Show>

                <div>
                  <label class='mb-1.5 block text-sm font-medium text-slate-700'>
                    Current Password
                  </label>
                  <div class='relative'>
                    <input
                      type={showCurrentPassword() ? 'text' : 'password'}
                      value={currentPassword()}
                      onInput={e => setCurrentPassword(e.target.value)}
                      class='block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none'
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowCurrentPassword(!showCurrentPassword())}
                      class='absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600'
                    >
                      <Show when={showCurrentPassword()} fallback={<FiEye class='h-4 w-4' />}>
                        <FiEyeOff class='h-4 w-4' />
                      </Show>
                    </button>
                  </div>
                </div>

                <div>
                  <label class='mb-1.5 block text-sm font-medium text-slate-700'>
                    New Password
                  </label>
                  <div class='relative'>
                    <input
                      type={showNewPassword() ? 'text' : 'password'}
                      value={newPassword()}
                      onInput={e => setNewPassword(e.target.value)}
                      class='block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none'
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowNewPassword(!showNewPassword())}
                      class='absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600'
                    >
                      <Show when={showNewPassword()} fallback={<FiEye class='h-4 w-4' />}>
                        <FiEyeOff class='h-4 w-4' />
                      </Show>
                    </button>
                  </div>
                  <StrengthIndicator password={newPassword()} onUnmet={setUnmetRequirements} />
                </div>

                <div>
                  <label class='mb-1.5 block text-sm font-medium text-slate-700'>
                    Confirm New Password
                  </label>
                  <input
                    type='password'
                    value={confirmPassword()}
                    onInput={e => setConfirmPassword(e.target.value)}
                    class='block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none'
                    required
                  />
                </div>

                <div class='flex gap-2'>
                  <button
                    type='submit'
                    disabled={changingPassword()}
                    class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50'
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
                    class='rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200'
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Show>

            {/* Divider */}
            <div class='border-t border-slate-100' />

            {/* Two-Factor Authentication */}
            <TwoFactorSetup />
          </div>
        </div>

        {/* Active Sessions Section */}
        <div class='mb-6 overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100'>
                <FiMonitor class='h-4 w-4 text-slate-600' />
              </div>
              <h2 class='text-base font-semibold text-slate-900'>Active Sessions</h2>
            </div>
          </div>
          <div class='p-6'>
            <SessionManagement />
          </div>
        </div>
      </div>
    </div>
  );
}
