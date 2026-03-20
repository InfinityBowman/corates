/**
 * SecuritySettings - Password, 2FA, linked accounts, session management
 */

import { useState, useCallback } from 'react';
import { ShieldIcon, KeyIcon, EyeIcon, EyeOffIcon, MailIcon, MonitorIcon } from 'lucide-react';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { Alert } from '@/components/ui/alert';
import { StrengthIndicator } from '@/components/auth/StrengthIndicator';
import { TwoFactorSetup } from './TwoFactorSetup';
import { LinkedAccountsSection } from './LinkedAccountsSection';
import { SessionManagement } from './SessionManagement';

export function SecuritySettings() {
  const user = useAuthStore(selectUser);
  const changePassword = useAuthStore(s => s.changePassword);
  const resetPassword = useAuthStore(s => s.resetPassword);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [unmetRequirements, setUnmetRequirements] = useState<string[]>([]);

  const [addPasswordLoading, setAddPasswordLoading] = useState(false);
  const [addPasswordSent, setAddPasswordSent] = useState(false);

  const handlePasswordChange = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError('');
      setPasswordSuccess('');

      if (unmetRequirements.length > 0) {
        setPasswordError(`Password must have ${unmetRequirements.join(', ')}`);
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('New passwords do not match.');
        return;
      }

      setChangingPassword(true);
      try {
        await changePassword(currentPassword, newPassword);
        setPasswordSuccess('Password changed successfully!');
        setShowPasswordForm(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { setError: setPasswordError, showToast: false });
      } finally {
        setChangingPassword(false);
      }
    },
    [currentPassword, newPassword, confirmPassword, unmetRequirements, changePassword],
  );

  const handleSendPasswordSetup = useCallback(async () => {
    setAddPasswordLoading(true);
    setPasswordError('');
    try {
      await resetPassword(user?.email || '');
      setAddPasswordSent(true);
    } catch {
      setPasswordError('Failed to send password setup email. Please try again.');
    } finally {
      setAddPasswordLoading(false);
    }
  }, [resetPassword, user?.email]);

  return (
    <div className='bg-background min-h-full py-8'>
      <div className='mx-auto max-w-3xl px-4 sm:px-6'>
        <div className='mb-8'>
          <h1 className='text-foreground text-2xl font-semibold tracking-tight'>Security</h1>
          <p className='text-muted-foreground mt-1'>
            Manage your account security and authentication
          </p>
        </div>

        {/* Linked Accounts */}
        <LinkedAccountsSection />

        {/* Password & 2FA */}
        <div
          data-section='security'
          className='border-border bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'
        >
          <div className='border-border bg-primary/5 border-b px-6 py-4'>
            <div className='flex items-center gap-2.5'>
              <div className='bg-primary/15 flex size-8 items-center justify-center rounded-lg'>
                <ShieldIcon className='text-primary size-4' />
              </div>
              <h2 className='text-foreground text-base font-semibold'>Password & Authentication</h2>
            </div>
          </div>
          <div className='flex flex-col gap-6 p-6'>
            {passwordSuccess && (
              <Alert variant='success'>
                {passwordSuccess}
              </Alert>
            )}

            {/* Add Password */}
            {addPasswordSent ?
              <Alert variant='info'>
                <MailIcon />
                <div>
                  <p className='font-medium'>Check your email</p>
                  <p className='mt-1 text-sm'>
                    We sent a link to <strong className='text-foreground'>{user?.email}</strong>{' '}
                    to set your password.
                  </p>
                  <button
                    type='button'
                    onClick={() => setAddPasswordSent(false)}
                    className='text-primary hover:text-primary/80 mt-2 text-sm font-medium transition-colors'
                  >
                    Dismiss
                  </button>
                </div>
              </Alert>
            : <div className='flex items-center justify-between'>
                <div>
                  <p className='text-foreground font-medium'>Add Password</p>
                  <p className='text-muted-foreground text-sm'>
                    Set a password to sign in without email links.
                  </p>
                  <p className='text-muted-foreground text-sm'>
                    A password is required for Two-Factor Authentication.
                  </p>
                </div>
                <button
                  onClick={handleSendPasswordSetup}
                  disabled={addPasswordLoading}
                  className='bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring/20 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow focus:ring-2 focus:outline-none disabled:opacity-50'
                >
                  <MailIcon className='size-4' />
                  <span>{addPasswordLoading ? 'Sending...' : 'Send Setup Email'}</span>
                </button>
              </div>
            }

            <div className='border-border border-t' />

            {/* Change Password */}
            {showPasswordForm ?
              <form onSubmit={handlePasswordChange} className='flex flex-col gap-4'>
                {passwordError && (
                  <Alert variant='destructive'>
                    {passwordError}
                  </Alert>
                )}
                <div>
                  <label className='text-secondary-foreground mb-1.5 block text-sm font-medium'>
                    Current Password
                  </label>
                  <div className='relative'>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className='border-border bg-card focus:border-primary focus:ring-ring/20 block w-full rounded-lg border px-3 py-2 pr-10 text-sm shadow-sm transition-colors focus:ring-2 focus:outline-none'
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className='text-muted-foreground hover:text-secondary-foreground absolute inset-y-0 right-0 flex items-center px-3 transition-colors'
                    >
                      {showCurrentPassword ?
                        <EyeOffIcon className='size-4' />
                      : <EyeIcon className='size-4' />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className='text-secondary-foreground mb-1.5 block text-sm font-medium'>
                    New Password
                  </label>
                  <div className='relative'>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className='border-border bg-card focus:border-primary focus:ring-ring/20 block w-full rounded-lg border px-3 py-2 pr-10 text-sm shadow-sm transition-colors focus:ring-2 focus:outline-none'
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className='text-muted-foreground hover:text-secondary-foreground absolute inset-y-0 right-0 flex items-center px-3 transition-colors'
                    >
                      {showNewPassword ?
                        <EyeOffIcon className='size-4' />
                      : <EyeIcon className='size-4' />}
                    </button>
                  </div>
                  <StrengthIndicator password={newPassword} onUnmet={setUnmetRequirements} />
                </div>
                <div>
                  <label className='text-secondary-foreground mb-1.5 block text-sm font-medium'>
                    Confirm New Password
                  </label>
                  <input
                    type='password'
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className='border-border bg-card focus:border-primary focus:ring-ring/20 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:ring-2 focus:outline-none'
                    required
                  />
                </div>
                <div className='flex gap-2'>
                  <button
                    type='submit'
                    disabled={changingPassword}
                    className='bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring/20 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow focus:ring-2 focus:outline-none disabled:opacity-50'
                  >
                    {changingPassword ? 'Changing...' : 'Update Password'}
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
                    className='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
                  >
                    Cancel
                  </button>
                </div>
              </form>
            : <div className='flex items-center justify-between'>
                <div>
                  <p className='text-foreground font-medium'>Change Password</p>
                  <p className='text-muted-foreground text-sm'>Update your existing password.</p>
                </div>
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className='bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
                >
                  <KeyIcon className='size-4' />
                  <span>Change Password</span>
                </button>
              </div>
            }

            <div className='border-border border-t' />

            {/* 2FA */}
            <TwoFactorSetup />
          </div>
        </div>

        {/* Sessions */}
        <div className='border-border bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div className='border-border from-muted/50 to-background border-b bg-gradient-to-r px-6 py-4'>
            <div className='flex items-center gap-2.5'>
              <div className='bg-secondary flex size-8 items-center justify-center rounded-lg'>
                <MonitorIcon className='text-secondary-foreground size-4' />
              </div>
              <h2 className='text-foreground text-base font-semibold'>Active Sessions</h2>
            </div>
          </div>
          <div className='p-6'>
            <SessionManagement />
          </div>
        </div>
      </div>
    </div>
  );
}
