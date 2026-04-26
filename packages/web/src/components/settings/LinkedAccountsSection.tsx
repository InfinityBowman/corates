/**
 * LinkedAccountsSection - Manages linked authentication providers
 * Handles linking, unlinking, OAuth callback errors, and account merge conflicts
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { LinkIcon, MailIcon, InfoIcon, AlertCircleIcon } from 'lucide-react';
import { authClient, authFetch } from '@/api/auth-client';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { useLinkedAccounts } from '@/hooks/useLinkedAccounts';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import { showToast } from '@/components/ui/toast';
import { Alert } from '@/components/ui/alert';
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
import { Skeleton } from '@/components/ui/skeleton';
import { AccountProviderCard } from './AccountProviderCard';
import { MergeAccountsDialog } from './MergeAccountsDialog';
import { parseOAuthError, getLinkErrorMessage } from '@/lib/account-linking-errors.js';

const PROVIDERS: Record<string, { id: string; name: string; icon: string | null }> = {
  google: { id: 'google', name: 'Google', icon: '/logos/google.svg' },
  orcid: { id: 'orcid', name: 'ORCID', icon: '/logos/orcid.svg' },
  credential: { id: 'credential', name: 'Email & Password', icon: null },
};

export function LinkedAccountsSection() {
  const { accounts, isLoading, error, refetch } = useLinkedAccounts();
  const user = useAuthStore(selectUser);

  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [accountToUnlink, setAccountToUnlink] = useState<LinkedAccount | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeConflictProvider, setMergeConflictProvider] = useState<string | null>(null);

  // Check for OAuth errors on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = parseOAuthError(params);

    if (oauthError) {
      let provider = params.get('provider');
      if (!provider) provider = sessionStorage.getItem('linkingProvider');
      if (!provider) {
        const pathMatch = window.location.pathname.match(/\/oauth2\/callback\/([^/]+)/);
        if (pathMatch) provider = pathMatch[1];
      }
      provider = provider || 'google';

      // Clean URL
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

      if (oauthError.message) {
        showToast.error('Link Failed', oauthError.message);
      }
    }
  }, []);

  const handleLinkProvider = useCallback(async (providerId: string) => {
    setLinkingProvider(providerId);
    try {
      if (providerId === 'credential') {
        const securitySection = document.querySelector('[data-section="security"]');
        if (securitySection) securitySection.scrollIntoView({ behavior: 'smooth' });
        showToast.info('Add Password', 'Use the Security section below to set up a password.');
        setLinkingProvider(null);
        return;
      }
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
      const message =
        getLinkErrorMessage(errObj.code as string) ||
        (errObj.message as string) ||
        'Failed to link account';
      showToast.error('Link Failed', message);
      setLinkingProvider(null);
      sessionStorage.removeItem('linkingProvider');
    }
  }, []);

  const handleUnlink = useCallback((account: LinkedAccount) => {
    setAccountToUnlink(account);
    setUnlinkError(null);
    setUnlinkDialogOpen(true);
  }, []);

  const confirmUnlink = useCallback(async () => {
    if (!accountToUnlink) return;
    setUnlinkingId(accountToUnlink.id);
    setUnlinkError(null);
    try {
      await authFetch(authClient.unlinkAccount({ providerId: accountToUnlink.providerId }));
      setUnlinkDialogOpen(false);
      showToast.success(
        'Unlinked',
        `${PROVIDERS[accountToUnlink.providerId]?.name || accountToUnlink.providerId} has been unlinked`,
      );
      refetch();
    } catch (err: unknown) {
      const errObj = err as Record<string, unknown>;
      const message =
        getLinkErrorMessage(errObj.code as string) ||
        (errObj.message as string) ||
        'Failed to unlink account. Please try again.';
      setUnlinkError(message);
    } finally {
      setUnlinkingId(null);
    }
  }, [accountToUnlink, refetch]);

  const availableProviders = useMemo(() => {
    const linked = new Set((accounts || []).map(a => a.providerId));
    return Object.values(PROVIDERS).filter(p => !linked.has(p.id));
  }, [accounts]);

  const canUnlink = useMemo(() => {
    const accountCount = accounts?.length || 0;
    const hasVerifiedEmail = !!user?.emailVerified;
    return accountCount > 1 || hasVerifiedEmail;
  }, [accounts, user?.emailVerified]);

  const unlinkProviderName = useMemo(
    () => (accountToUnlink ? PROVIDERS[accountToUnlink.providerId]?.name || accountToUnlink.providerId : ''),
    [accountToUnlink],
  );

  return (
    <div className='border-border bg-card mb-6 overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-border from-muted/50 to-background border-b bg-linear-to-r px-6 py-4'>
        <div className='flex items-center gap-2'>
          <LinkIcon className='text-secondary-foreground size-5' />
          <h2 className='text-foreground text-lg font-medium'>Linked Accounts</h2>
        </div>
        <p className='text-muted-foreground mt-1 text-sm'>Manage how you sign in to CoRATES</p>
      </div>

      <div className='flex flex-col gap-4 p-6'>
        {error && (
          <Alert variant='destructive'>
            <AlertCircleIcon />
            <div>
              <p className='font-medium'>Failed to load linked accounts</p>
              <p className='mt-1 text-sm'>{(error as Error)?.message}</p>
              <button onClick={() => refetch()} className='mt-2 text-sm font-medium underline'>
                Try again
              </button>
            </div>
          </Alert>
        )}

        {accounts?.length > 0 ?
          <div className='flex flex-col gap-3' role='list' aria-label='Linked accounts'>
            {accounts.map(account => (
              <AccountProviderCard
                key={account.id}
                account={account}
                provider={PROVIDERS[account.providerId]}
                canUnlink={canUnlink}
                unlinking={unlinkingId === account.id}
                onUnlink={() => handleUnlink(account)}
              />
            ))}
          </div>
        : isLoading && (
            <div className='flex flex-col gap-3'>
              <div className='border-border flex items-center justify-between rounded-lg border p-4'>
                <div className='flex items-center gap-3'>
                  <Skeleton className='size-10 rounded-lg' />
                  <div className='flex flex-col gap-2'>
                    <Skeleton className='h-4 w-24' />
                    <Skeleton className='h-3 w-32' />
                  </div>
                </div>
                <Skeleton className='h-8 w-16' />
              </div>
            </div>
          )
        }

        {availableProviders.length > 0 && (
          <div className={accounts?.length > 0 ? 'border-border mt-4 border-t pt-4' : ''}>
            <p className='text-secondary-foreground mb-3 text-sm font-medium'>
              {accounts?.length > 0 ? 'Link another account:' : 'Link an account:'}
            </p>
            <div className='flex flex-wrap gap-2'>
              {availableProviders.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => handleLinkProvider(provider.id)}
                  disabled={linkingProvider === provider.id}
                  className='bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                  aria-label={`Link ${provider.name} account`}
                >
                  {provider.icon ?
                    <img src={provider.icon} alt='' className='size-4' />
                  : <MailIcon className='size-4' />}
                  {linkingProvider === provider.id ? 'Linking...' : `+ ${provider.name}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <Alert variant='info' className='mt-4'>
          <InfoIcon />
          <p className='text-sm'>
            <strong>Why link accounts?</strong> Linking multiple sign-in methods gives you backup
            options if you lose access to one. Your projects and data are shared across all linked
            accounts.
          </p>
        </Alert>
      </div>

      {/* Unlink confirmation dialog */}
      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink {unlinkProviderName}?</AlertDialogTitle>
            <AlertDialogDescription>
              You won&apos;t be able to sign in with <strong>{unlinkProviderName}</strong> anymore.
              Your CoRATES data will not be affected.
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
              {unlinkingId ? 'Unlinking...' : 'Unlink'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge dialog */}
      <MergeAccountsDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        conflictProvider={mergeConflictProvider}
        onSuccess={() => {
          setShowMergeDialog(false);
          refetch();
        }}
      />
    </div>
  );
}
