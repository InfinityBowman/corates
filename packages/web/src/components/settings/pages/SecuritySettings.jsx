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
    <div class='bg-background min-h-full py-8'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <div class='mb-8'>
          <h1 class='text-foreground text-2xl font-semibold tracking-tight'>Security</h1>
          <p class='text-muted-foreground mt-1'>Manage your account security and authentication</p>
        </div>

        {/* Linked Accounts Section */}
        <LinkedAccountsSection />

        {/* Password & 2FA Section */}
        <div
          data-section='security'
          class='border-border bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'
        >
          <div class='border-border-subtle border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='bg-primary-subtle flex h-8 w-8 items-center justify-center rounded-lg'>
                <FiShield class='text-primary h-4 w-4' />
              </div>
              <h2 class='text-foreground text-base font-semibold'>Password & Authentication</h2>
            </div>
          </div>
          <div class='space-y-6 p-6'>
            <Show when={passwordSuccess()}>
              <div class='border-success/30 bg-success-subtle text-success rounded-lg border p-3 text-sm'>
                {passwordSuccess()}
              </div>
            </Show>

            {/* Add Password Option - for users who signed up via magic link or OAuth */}
            <Show when={addPasswordSent()}>
              <div class='border-primary/30 bg-primary-subtle rounded-lg border p-4'>
                <div class='flex items-start space-x-3'>
                  <div class='bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg'>
                    <FiMail class='text-primary h-4 w-4' />
                  </div>
                  <div>
                    <p class='text-foreground font-medium'>Check your email</p>
                    <p class='text-secondary-foreground mt-1 text-sm'>
                      We sent a link to <strong class='text-foreground'>{user()?.email}</strong> to
                      set your password.
                    </p>
                    <button
                      type='button'
                      onClick={() => setAddPasswordSent(false)}
                      class='text-primary hover:text-primary/80 mt-2 text-sm font-medium transition-colors'
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
                  <p class='text-foreground font-medium'>Add Password</p>
                  <p class='text-muted-foreground text-sm'>
                    Set a password to sign in without email links.
                  </p>
                  <p class='text-muted-foreground text-sm'>
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
                  class='bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring/20 flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow focus:ring-2 focus:outline-none disabled:opacity-50'
                >
                  <FiMail class='h-4 w-4' />
                  <span>{addPasswordLoading() ? 'Sending...' : 'Send Setup Email'}</span>
                </button>
              </div>
            </Show>

            {/* Divider */}
            <div class='border-border-subtle border-t' />

            {/* Change Password Option - for users who already have a password */}
            <Show
              when={showPasswordForm()}
              fallback={
                <div class='flex items-center justify-between'>
                  <div>
                    <p class='text-foreground font-medium'>Change Password</p>
                    <p class='text-muted-foreground text-sm'>Update your existing password.</p>
                  </div>
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    class='bg-muted text-secondary-foreground hover:bg-secondary flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
                  >
                    <FiKey class='h-4 w-4' />
                    <span>Change Password</span>
                  </button>
                </div>
              }
            >
              <form onSubmit={handlePasswordChange} class='space-y-4'>
                <Show when={passwordError()}>
                  <div class='border-destructive/30 bg-destructive-subtle text-destructive rounded-lg border p-3 text-sm'>
                    {passwordError()}
                  </div>
                </Show>

                <div>
                  <label class='text-secondary-foreground mb-1.5 block text-sm font-medium'>
                    Current Password
                  </label>
                  <div class='relative'>
                    <input
                      type={showCurrentPassword() ? 'text' : 'password'}
                      value={currentPassword()}
                      onInput={e => setCurrentPassword(e.target.value)}
                      class='border-border bg-card focus:border-primary focus:ring-ring/20 block w-full rounded-lg border px-3 py-2 pr-10 text-sm shadow-sm transition-colors focus:ring-2 focus:outline-none'
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowCurrentPassword(!showCurrentPassword())}
                      class='text-muted-foreground hover:text-secondary-foreground absolute inset-y-0 right-0 flex items-center px-3 transition-colors'
                    >
                      <Show when={showCurrentPassword()} fallback={<FiEye class='h-4 w-4' />}>
                        <FiEyeOff class='h-4 w-4' />
                      </Show>
                    </button>
                  </div>
                </div>

                <div>
                  <label class='text-secondary-foreground mb-1.5 block text-sm font-medium'>
                    New Password
                  </label>
                  <div class='relative'>
                    <input
                      type={showNewPassword() ? 'text' : 'password'}
                      value={newPassword()}
                      onInput={e => setNewPassword(e.target.value)}
                      class='border-border bg-card focus:border-primary focus:ring-ring/20 block w-full rounded-lg border px-3 py-2 pr-10 text-sm shadow-sm transition-colors focus:ring-2 focus:outline-none'
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowNewPassword(!showNewPassword())}
                      class='text-muted-foreground hover:text-secondary-foreground absolute inset-y-0 right-0 flex items-center px-3 transition-colors'
                    >
                      <Show when={showNewPassword()} fallback={<FiEye class='h-4 w-4' />}>
                        <FiEyeOff class='h-4 w-4' />
                      </Show>
                    </button>
                  </div>
                  <StrengthIndicator password={newPassword()} onUnmet={setUnmetRequirements} />
                </div>

                <div>
                  <label class='text-secondary-foreground mb-1.5 block text-sm font-medium'>
                    Confirm New Password
                  </label>
                  <input
                    type='password'
                    value={confirmPassword()}
                    onInput={e => setConfirmPassword(e.target.value)}
                    class='border-border bg-card focus:border-primary focus:ring-ring/20 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:ring-2 focus:outline-none'
                    required
                  />
                </div>

                <div class='flex gap-2'>
                  <button
                    type='submit'
                    disabled={changingPassword()}
                    class='bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring/20 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow focus:ring-2 focus:outline-none disabled:opacity-50'
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
                    class='bg-muted text-secondary-foreground hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium transition-colors'
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Show>

            {/* Divider */}
            <div class='border-border-subtle border-t' />

            {/* Two-Factor Authentication */}
            <TwoFactorSetup />
          </div>
        </div>

        {/* Active Sessions Section */}
        <div class='border-border bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-border-subtle border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100'>
                <FiMonitor class='h-4 w-4 text-slate-600' />
              </div>
              <h2 class='text-foreground text-base font-semibold'>Active Sessions</h2>
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
