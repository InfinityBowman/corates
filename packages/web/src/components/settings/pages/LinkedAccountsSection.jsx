/**
 * LinkedAccountsSection - Manages linked authentication providers
 *
 * Features:
 * - Lists all linked accounts (Google, ORCID, credential)
 * - Link new providers
 * - Unlink providers (with safety check)
 * - Shows provider-specific info (email, ORCID ID, etc.)
 * - Handles OAuth callback errors
 * - Offers account merge when linking conflicts with another user
 */

import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { FiLink, FiMail, FiInfo, FiAlertCircle, FiX } from 'solid-icons/fi';
import { authClient } from '@api/auth-client.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useLinkedAccounts } from '@/primitives/useLinkedAccounts.js';
import { showToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import AccountProviderCard from './AccountProviderCard.jsx';
import MergeAccountsDialog from './MergeAccountsDialog.jsx';
import { parseOAuthError, getLinkErrorMessage } from '@lib/account-linking-errors.js';

// Provider metadata
const PROVIDERS = {
  google: {
    id: 'google',
    name: 'Google',
    icon: '/logos/google.svg',
    description: 'Sign in with your Google account',
  },
  orcid: {
    id: 'orcid',
    name: 'ORCID',
    icon: '/logos/orcid.svg',
    description: 'Link your ORCID researcher ID',
  },
  credential: {
    id: 'credential',
    name: 'Email & Password',
    icon: null, // Uses FiMail icon
    description: 'Sign in with email and password',
  },
};

export default function LinkedAccountsSection() {
  // Fetch linked accounts with TanStack Query (cached across navigations)
  const { accounts, isLoading, error, refetch } = useLinkedAccounts();

  // UI state
  const [unlinkingId, setUnlinkingId] = createSignal(null);
  const [linkingProvider, setLinkingProvider] = createSignal(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = createSignal(false);
  const [accountToUnlink, setAccountToUnlink] = createSignal(null);
  const [unlinkError, setUnlinkError] = createSignal(null);

  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = createSignal(false);
  const [mergeConflictProvider, setMergeConflictProvider] = createSignal(null);

  // Check for OAuth errors in URL on mount
  onMount(async () => {
    const params = new URLSearchParams(window.location.search);

    // Check for OAuth errors
    const error = parseOAuthError(params);

    if (error) {
      // Get provider from URL param, sessionStorage (stored when linking started),
      // or callback path (e.g., /api/auth/oauth2/callback/orcid)
      let provider = params.get('provider');

      if (!provider) {
        // Check if stored in sessionStorage from when linking started
        provider = sessionStorage.getItem('linkingProvider');
      }

      if (!provider) {
        // Try to extract from callback path (e.g., /api/auth/oauth2/callback/orcid)
        const pathMatch = window.location.pathname.match(/\/oauth2\/callback\/([^/]+)/);
        if (pathMatch) {
          provider = pathMatch[1];
        }
      }

      // Fallback to google if still not found
      provider = provider || 'google';

      // Clean URL params and sessionStorage
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      url.searchParams.delete('provider');
      window.history.replaceState({}, '', url.pathname + url.search);
      sessionStorage.removeItem('linkingProvider');

      // Check if this is an "already linked" error - offer merge option
      if (error.code === 'ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER') {
        // Show merge dialog instead of just an error toast
        // Small delay to ensure dialog machine is fully initialized
        setMergeConflictProvider(provider);
        setTimeout(() => {
          setShowMergeDialog(true);
        }, 100);
        return;
      }

      // Only show toast if message is not null (null = silent/user cancelled)
      if (error.message) {
        showToast.error('Link Failed', error.message);
      }
    }
  });

  /**
   * Handle linking a social provider
   */
  async function handleLinkProvider(providerId) {
    setLinkingProvider(providerId);
    try {
      // For credential provider, redirect to add password section
      if (providerId === 'credential') {
        // Scroll to security section or show modal
        const securitySection = document.querySelector('[data-section="security"]');
        if (securitySection) {
          securitySection.scrollIntoView({ behavior: 'smooth' });
        }
        showToast.info('Add Password', 'Use the Security section below to set up a password.');
        setLinkingProvider(null);
        return;
      }

      // Store the provider being linked so we can use it if the callback doesn't include it
      sessionStorage.setItem('linkingProvider', providerId);

      await authClient.linkSocial({
        provider: providerId,
        callbackURL: window.location.href,
        errorCallbackURL: window.location.href,
      });
      // Will redirect to OAuth provider, no need to handle success here
    } catch (err) {
      const message = getLinkErrorMessage(err.code) || err.message || 'Failed to link account';
      showToast.error('Link Failed', message);
      setLinkingProvider(null);
      sessionStorage.removeItem('linkingProvider');
    }
  }

  /**
   * Open unlink confirmation dialog
   */
  function handleUnlink(account) {
    setAccountToUnlink(account);
    setUnlinkError(null);
    setShowUnlinkConfirm(true);
  }

  /**
   * Confirm and execute unlink
   */
  async function confirmUnlink() {
    const account = accountToUnlink();
    if (!account) return;

    setUnlinkingId(account.id);
    setUnlinkError(null);

    try {
      // Better Auth's unlinkAccount expects:
      // - providerId: required (e.g., 'google')
      // - accountId: optional, the provider's account ID (e.g., Google's user ID)
      // If only providerId is given, it unlinks the first account of that provider
      await authClient.unlinkAccount({
        providerId: account.providerId,
      });
      setShowUnlinkConfirm(false);
      showToast.success(
        'Unlinked',
        `${PROVIDERS[account.providerId]?.name || account.providerId} has been unlinked`,
      );
      refetch();
    } catch (err) {
      // Keep dialog open on error, show error inline
      const message =
        getLinkErrorMessage(err.code) ||
        err.message ||
        'Failed to unlink account. Please try again.';
      setUnlinkError(message);
    } finally {
      setUnlinkingId(null);
    }
  }

  // Determine which providers can still be linked
  const availableProviders = createMemo(() => {
    const linked = new Set((accounts() || []).map(a => a.providerId));
    return Object.values(PROVIDERS).filter(p => !linked.has(p.id));
  });

  // Get auth store for user info
  const authStore = useBetterAuth();

  // Can unlink if:
  // 1. More than 1 OAuth account linked, OR
  // 2. User has a verified email (can use magic link to sign back in)
  const canUnlink = createMemo(() => {
    const accountCount = accounts()?.length || 0;
    const hasVerifiedEmail = authStore.user()?.emailVerified;
    return accountCount > 1 || hasVerifiedEmail;
  });

  // Get display name for unlink dialog
  const unlinkProviderName = createMemo(() => {
    const account = accountToUnlink();
    if (!account) return '';
    return PROVIDERS[account.providerId]?.name || account.providerId;
  });

  return (
    <div class='border-border bg-card mb-6 overflow-hidden rounded-lg border shadow-sm'>
      {/* Header */}
      <div class='border-border border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
        <div class='flex items-center space-x-2'>
          <FiLink class='text-secondary-foreground h-5 w-5' />
          <h2 class='text-foreground text-lg font-medium'>Linked Accounts</h2>
        </div>
        <p class='text-muted-foreground mt-1 text-sm'>Manage how you sign in to CoRATES</p>
      </div>

      <div class='space-y-4 p-6'>
        {/* Error state */}
        <Show when={error()}>
          <div class='border-destructive/30 bg-destructive-subtle rounded-lg border p-4'>
            <div class='flex items-start gap-3'>
              <FiAlertCircle class='text-destructive mt-0.5 h-5 w-5' />
              <div>
                <p class='text-destructive font-medium'>Failed to load linked accounts</p>
                <p class='text-destructive mt-1 text-sm'>{error()?.message}</p>
                <button
                  onClick={() => refetch()}
                  class='text-destructive hover:text-destructive mt-2 text-sm font-medium underline'
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Linked accounts list - show cached data immediately, or loading skeleton on first load */}
        <Show
          when={accounts().length > 0}
          fallback={
            <Show when={isLoading()}>
              {/* Loading skeleton */}
              <div class='space-y-3'>
                <div class='border-border flex animate-pulse items-center justify-between rounded-lg border p-4'>
                  <div class='flex items-center gap-3'>
                    <div class='bg-secondary h-10 w-10 rounded-lg' />
                    <div class='space-y-2'>
                      <div class='bg-secondary h-4 w-24 rounded' />
                      <div class='bg-secondary h-3 w-32 rounded' />
                    </div>
                  </div>
                  <div class='bg-secondary h-8 w-16 rounded' />
                </div>
              </div>
            </Show>
          }
        >
          <div class='space-y-3' role='list' aria-label='Linked accounts'>
            <For each={accounts()}>
              {account => (
                <AccountProviderCard
                  account={account}
                  provider={PROVIDERS[account.providerId]}
                  canUnlink={canUnlink()}
                  unlinking={unlinkingId() === account.id}
                  onUnlink={() => handleUnlink(account)}
                />
              )}
            </For>
          </div>
        </Show>

        {/* Available providers to link */}
        <Show when={availableProviders().length > 0}>
          <div class={accounts()?.length > 0 ? 'border-border mt-4 border-t pt-4' : ''}>
            <p class='text-secondary-foreground mb-3 text-sm font-medium'>
              {accounts()?.length > 0 ? 'Link another account:' : 'Link an account:'}
            </p>
            <div class='flex flex-wrap gap-2'>
              <For each={availableProviders()}>
                {provider => (
                  <button
                    onClick={() => handleLinkProvider(provider.id)}
                    disabled={linkingProvider() === provider.id}
                    class='bg-muted text-secondary-foreground hover:bg-secondary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                    aria-label={`Link ${provider.name} account`}
                  >
                    <Show when={provider.icon} fallback={<FiMail class='h-4 w-4' />}>
                      <img src={provider.icon} alt='' class='h-4 w-4' />
                    </Show>
                    {linkingProvider() === provider.id ? 'Linking...' : `+ ${provider.name}`}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Info box */}
        <div class='border-primary/30 bg-primary-subtle mt-4 rounded-lg border p-4'>
          <div class='flex items-start gap-3'>
            <FiInfo class='text-primary mt-0.5 h-5 w-5 shrink-0' />
            <p class='text-primary text-sm'>
              <strong>Why link accounts?</strong> Linking multiple sign-in methods gives you backup
              options if you lose access to one. Your projects and data are shared across all linked
              accounts.
            </p>
          </div>
        </div>

        {/* Dev mode: Test merge dialog */}
        {import.meta.env.DEV && (
          <div class='border-warning/30 bg-warning-subtle mt-4 rounded-lg border p-4'>
            <p class='text-warning mb-2 text-xs font-semibold'>Dev Mode: Test Merge Flow</p>
            <div class='flex gap-2'>
              <button
                onClick={() => {
                  setMergeConflictProvider('orcid');
                  setShowMergeDialog(true);
                }}
                class='bg-warning hover:bg-warning/90 rounded px-3 py-1.5 text-xs font-medium text-white transition-colors'
              >
                Test ORCID Merge
              </button>
              <button
                onClick={() => {
                  setMergeConflictProvider('google');
                  setShowMergeDialog(true);
                }}
                class='bg-warning hover:bg-warning/90 rounded px-3 py-1.5 text-xs font-medium text-white transition-colors'
              >
                Test Google Merge
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unlink confirmation dialog */}
      <Dialog
        open={showUnlinkConfirm()}
        onOpenChange={open => {
          if (!open) {
            setShowUnlinkConfirm(false);
            setAccountToUnlink(null);
            setUnlinkError(null);
          }
        }}
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent class='max-w-md'>
            <DialogHeader>
              <DialogTitle>Unlink {unlinkProviderName()}?</DialogTitle>
              <DialogCloseTrigger aria-label='Close'>
                <FiX class='h-5 w-5' />
              </DialogCloseTrigger>
            </DialogHeader>
            <DialogBody>
              <div class='space-y-4'>
                <p class='text-secondary-foreground'>
                  You won't be able to sign in with <strong>{unlinkProviderName()}</strong> anymore.
                  Your CoRATES data will not be affected.
                </p>

                <p class='text-muted-foreground text-sm'>
                  <strong>Note:</strong> If you sign in with {unlinkProviderName()} later without
                  linking first, a new separate account will be created.
                </p>

                {/* Error message */}
                <Show when={unlinkError()}>
                  <div class='border-destructive/30 bg-destructive-subtle rounded-md border p-3'>
                    <p class='text-destructive text-sm'>{unlinkError()}</p>
                  </div>
                </Show>

                <div class='flex justify-end gap-3 pt-2'>
                  <button
                    onClick={() => setShowUnlinkConfirm(false)}
                    class='bg-muted text-secondary-foreground hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium transition-colors'
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmUnlink}
                    disabled={unlinkingId() !== null}
                    class='bg-destructive hover:bg-destructive/90 focus:ring-ring rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:opacity-50'
                  >
                    {unlinkingId() ? 'Unlinking...' : 'Unlink'}
                  </button>
                </div>
              </div>
            </DialogBody>
          </DialogContent>
        </DialogPositioner>
      </Dialog>

      {/* Merge accounts dialog - shown when linking conflicts with another user */}
      <MergeAccountsDialog
        open={showMergeDialog()}
        onOpenChange={setShowMergeDialog}
        conflictProvider={mergeConflictProvider()}
        onSuccess={() => {
          setShowMergeDialog(false);
          refetch();
        }}
      />
    </div>
  );
}
