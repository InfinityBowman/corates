/** Password, linked providers, and two-factor as one list of sign-in methods. */

import { useNavigate } from '@tanstack/react-router';
import { useState, useMemo, useEffect, useCallback, useId } from 'react';
import { MailIcon, KeyIcon, KeyRoundIcon, ExternalLinkIcon, AlertCircleIcon } from 'lucide-react';
import { authClient, authFetch } from '@/api/auth-client';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { useLinkedAccounts } from '@/hooks/useLinkedAccounts';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import { showToast } from '@/lib/toast';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { StrengthIndicator } from '@/components/auth/StrengthIndicator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MergeAccountsDialog } from './MergeAccountsDialog';
import { TwoFactorSetup } from './TwoFactorSetup';
import { SettingsSection, SettingsRow } from './primitives';
import { parseOAuthError, getLinkErrorMessage } from '@/lib/account-linking-errors.js';

const SOCIAL_PROVIDERS = [
  { id: 'google', name: 'Google', icon: '/logos/google.svg' },
  { id: 'orcid', name: 'ORCID', icon: '/logos/orcid.svg' },
];

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google',
  orcid: 'ORCID',
  credential: 'Email and password',
};

function formatOrcidId(id: string) {
  if (!id) return '';
  if (id.includes('-')) return id;
  return id.replace(/(\d{4})(\d{4})(\d{4})(\d{3}[\dXx])/, '$1-$2-$3-$4');
}

// listAccounts returns createdAt as a Date once the client has parsed it, but
// as an ISO string or epoch seconds over the wire.
function formatLinkedDate(value: unknown) {
  if (value === null || value === undefined) return null;
  const date =
    value instanceof Date ? value
    : typeof value === 'number' ? new Date(value * 1000)
    : typeof value === 'string' ? new Date(value)
    : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function connectedOn(value: unknown) {
  const date = formatLinkedDate(value);
  return date ? `Connected ${date}` : null;
}

function MethodLogo({ src, alt }: { src?: string; alt?: string }) {
  return (
    <div className='border-border bg-card flex size-9 items-center justify-center rounded-lg border'>
      {src ?
        <img src={src} alt={alt} className='size-4.5' />
      : <MailIcon className='text-muted-foreground size-4.5' />}
    </div>
  );
}

export function SignInMethodsSection() {
  const navigate = useNavigate();
  const { accounts, isLoading, error, refetch } = useLinkedAccounts();
  const user = useAuthStore(selectUser);
  const changePassword = useAuthStore(s => s.changePassword);
  const requestPasswordResetCode = useAuthStore(s => s.requestPasswordResetCode);
  const fieldId = useId();

  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [accountToUnlink, setAccountToUnlink] = useState<LinkedAccount | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeConflictProvider, setMergeConflictProvider] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [unmetRequirements, setUnmetRequirements] = useState<string[]>([]);
  const [setupEmailLoading, setSetupEmailLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = parseOAuthError(params);
    if (!oauthError) return;

    let provider = params.get('provider') || sessionStorage.getItem('linkingProvider');
    if (!provider) {
      const pathMatch = window.location.pathname.match(/\/callback\/([^/]+)/);
      if (pathMatch) provider = pathMatch[1];
    }
    provider = provider || 'google';

    const url = new URL(window.location.href);
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    url.searchParams.delete('provider');
    window.history.replaceState({}, '', url.pathname + url.search);
    sessionStorage.removeItem('linkingProvider');

    if (oauthError.code === 'ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER') {
      setMergeConflictProvider(provider);
      setTimeout(() => setShowMergeDialog(true), 100);
      return;
    }
    if (oauthError.message) showToast.error('Could not connect that account', oauthError.message);
  }, []);

  const linked = useMemo(() => {
    const byProvider = new Map<string, LinkedAccount>();
    for (const account of accounts || []) byProvider.set(account.providerId, account);
    return byProvider;
  }, [accounts]);

  const credentialAccount = linked.get('credential');

  // A verified email is a fallback way in, so it also counts as a second method.
  const canUnlink = (accounts?.length || 0) > 1 || !!user?.emailVerified;

  const handleLink = useCallback(async (providerId: string) => {
    setLinkingProvider(providerId);
    try {
      sessionStorage.setItem('linkingProvider', providerId);
      await authFetch(
        authClient.linkSocial({
          provider: providerId as 'google',
          callbackURL: window.location.href,
          errorCallbackURL: window.location.href,
        }),
      );
    } catch (err: unknown) {
      const errObj = err as Record<string, unknown>;
      showToast.error(
        'Could not connect that account',
        getLinkErrorMessage(errObj.code as string) ||
          (errObj.message as string) ||
          'Could not link that account. Try again.',
      );
      setLinkingProvider(null);
      sessionStorage.removeItem('linkingProvider');
    }
  }, []);

  const confirmUnlink = useCallback(async () => {
    if (!accountToUnlink) return;
    setUnlinkingId(accountToUnlink.id);
    setUnlinkError(null);
    try {
      await authFetch(authClient.unlinkAccount({ accountId: accountToUnlink.id }));
      showToast.success(
        'Disconnected',
        `${PROVIDER_NAMES[accountToUnlink.providerId] || accountToUnlink.providerId} is no longer a sign-in method on your account.`,
      );
      setAccountToUnlink(null);
      refetch();
    } catch (err: unknown) {
      const errObj = err as Record<string, unknown>;
      setUnlinkError(
        getLinkErrorMessage(errObj.code as string) ||
          (errObj.message as string) ||
          'Could not disconnect that method. Try again.',
      );
    } finally {
      setUnlinkingId(null);
    }
  }, [accountToUnlink, refetch]);

  const handleSendSetupEmail = useCallback(async () => {
    const email = (user?.email as string) || '';
    setSetupEmailLoading(true);
    setPasswordError('');
    try {
      await requestPasswordResetCode(email);
      navigate({ to: '/reset-password', search: { email, sent: '1' } });
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { setError: setPasswordError, showToast: false });
    } finally {
      setSetupEmailLoading(false);
    }
  }, [requestPasswordResetCode, navigate, user?.email]);

  const resetPasswordForm = useCallback(() => {
    setShowPasswordForm(false);
    setPasswordError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, []);

  const handlePasswordChange = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError('');

      if (unmetRequirements.length > 0) {
        setPasswordError(`Your new password still needs ${unmetRequirements.join(', ')}.`);
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('New passwords do not match.');
        return;
      }

      setChangingPassword(true);
      try {
        await changePassword(currentPassword, newPassword);
        showToast.success('Password changed', 'Use your new password next time you sign in.');
        resetPasswordForm();
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { setError: setPasswordError, showToast: false });
      } finally {
        setChangingPassword(false);
      }
    },
    [
      currentPassword,
      newPassword,
      confirmPassword,
      unmetRequirements,
      changePassword,
      resetPasswordForm,
    ],
  );

  const unlinkProviderName =
    accountToUnlink ? PROVIDER_NAMES[accountToUnlink.providerId] || accountToUnlink.providerId : '';

  return (
    <SettingsSection
      title='Sign-in methods'
      description='Keep more than one, so you can still sign in if you lose access to one of them.'
      icon={KeyRoundIcon}
    >
      {error && (
        <div className='p-4'>
          <Alert variant='destructive'>
            <AlertCircleIcon />
            <div>
              <p className='font-medium'>Could not load your sign-in methods</p>
              <p className='mt-1 text-sm'>{(error as Error)?.message}</p>
              <Button
                variant='link'
                onClick={() => refetch()}
                className='mt-1 h-auto p-0 text-current underline'
              >
                Try again
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {isLoading && !accounts?.length ?
        <div className='flex items-center gap-3 p-4'>
          <Skeleton className='size-9 rounded-lg' />
          <div className='flex flex-1 flex-col gap-2'>
            <Skeleton className='h-3.5 w-32' />
            <Skeleton className='h-3 w-44' />
          </div>
          <Skeleton className='h-8 w-24' />
        </div>
      : <>
          {/* Password */}
          <SettingsRow
            media={<MethodLogo />}
            label='Email and password'
            description={
              credentialAccount ?
                (user?.email as string)
              : 'Not set. Sign in with an emailed code instead.'
            }
            meta={
              credentialAccount ?
                formatLinkedDate(credentialAccount.createdAt) &&
                `Added ${formatLinkedDate(credentialAccount.createdAt)}`
              : null
            }
            alignTop={showPasswordForm}
            expanded={
              showPasswordForm ?
                <form onSubmit={handlePasswordChange} className='flex max-w-sm flex-col gap-4'>
                  {passwordError && <Alert variant='destructive'>{passwordError}</Alert>}
                  <div>
                    <Label htmlFor={`${fieldId}-current`} className='mb-1.5 text-[13px]'>
                      Current password
                    </Label>
                    <PasswordInput
                      id={`${fieldId}-current`}
                      autoComplete='current-password'
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${fieldId}-new`} className='mb-1.5 text-[13px]'>
                      New password
                    </Label>
                    <PasswordInput
                      id={`${fieldId}-new`}
                      autoComplete='new-password'
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                    />
                    <StrengthIndicator password={newPassword} onUnmet={setUnmetRequirements} />
                  </div>
                  <div>
                    <Label htmlFor={`${fieldId}-confirm`} className='mb-1.5 text-[13px]'>
                      Confirm new password
                    </Label>
                    <PasswordInput
                      id={`${fieldId}-confirm`}
                      autoComplete='new-password'
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className='flex gap-2'>
                    <Button type='submit' disabled={changingPassword}>
                      {changingPassword ? 'Saving...' : 'Change password'}
                    </Button>
                    <Button type='button' variant='ghost' onClick={resetPasswordForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              : null
            }
          >
            {!showPasswordForm &&
              (credentialAccount ?
                <Button variant='outline' onClick={() => setShowPasswordForm(true)}>
                  <KeyIcon className='size-4' />
                  Change password
                </Button>
              : <Button
                  variant='outline'
                  onClick={handleSendSetupEmail}
                  disabled={setupEmailLoading}
                >
                  <MailIcon className='size-4' />
                  {setupEmailLoading ? 'Sending...' : 'Set a password'}
                </Button>)}
          </SettingsRow>

          {/* Social providers */}
          {SOCIAL_PROVIDERS.map(provider => {
            const account = linked.get(provider.id);
            const orcidId =
              provider.id === 'orcid' && account?.accountId ?
                formatOrcidId(account.accountId)
              : null;

            return (
              <SettingsRow
                key={provider.id}
                media={<MethodLogo src={provider.icon} alt={provider.name} />}
                label={
                  <span className='flex items-center gap-2'>
                    {provider.name}
                    {account && <Badge variant='success'>Connected</Badge>}
                  </span>
                }
                description={
                  !account ? 'Not connected'
                  : orcidId ?
                    <span className='inline-flex items-center gap-1'>
                      {orcidId}
                      <a
                        href={`https://orcid.org/${orcidId}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='hover:text-foreground transition-colors'
                        aria-label='View ORCID profile'
                      >
                        <ExternalLinkIcon className='size-3.5' />
                      </a>
                    </span>
                  : connectedOn(account.createdAt)
                }
                meta={account && orcidId ? connectedOn(account.createdAt) : null}
              >
                {!account ?
                  <Button
                    variant='outline'
                    onClick={() => handleLink(provider.id)}
                    disabled={linkingProvider === provider.id}
                  >
                    {linkingProvider === provider.id ? 'Connecting...' : 'Connect'}
                  </Button>
                : canUnlink ?
                  <Button
                    variant='ghost'
                    onClick={() => {
                      setAccountToUnlink(account);
                      setUnlinkError(null);
                    }}
                    disabled={unlinkingId === account.id}
                    className='text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                  >
                    {unlinkingId === account.id ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                : <Tooltip>
                    <TooltipTrigger>
                      <span className='text-muted-foreground/70 cursor-help text-xs'>
                        Only method
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      This is your only way to sign in. Add another method before disconnecting it.
                    </TooltipContent>
                  </Tooltip>
                }
              </SettingsRow>
            );
          })}

          <TwoFactorSetup />
        </>
      }

      <AlertDialog
        open={!!accountToUnlink}
        onOpenChange={open => {
          if (!open) setAccountToUnlink(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {unlinkProviderName}?</AlertDialogTitle>
            <AlertDialogDescription>
              You won&apos;t be able to sign in with <strong>{unlinkProviderName}</strong> anymore.
              Your projects and data stay where they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {unlinkError && <Alert variant='destructive'>{unlinkError}</Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={unlinkingId !== null}
              onClick={confirmUnlink}
            >
              {unlinkingId ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MergeAccountsDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        conflictProvider={mergeConflictProvider}
        onSuccess={() => {
          setShowMergeDialog(false);
          refetch();
        }}
      />
    </SettingsSection>
  );
}
