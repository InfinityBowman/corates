/**
 * Hook to handle OAuth errors from URL params
 *
 * Better Auth redirects to errorCallbackURL with ?error=<code> on OAuth failures.
 * This hook parses the error, shows a toast notification, and cleans up the URL.
 */

import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { parseOAuthError } from '@/lib/account-linking-errors.js';
import { showToast } from '@/components/ui/toast';

export function useOAuthError() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsedError = parseOAuthError(params);

    if (!parsedError) return;

    const { message } = parsedError;

    // Silent errors (user cancelled) - clean up without notification
    if (message === null) {
      localStorage.removeItem('oauthSignup');
      cleanupUrl(location.pathname);
      return;
    }

    showToast.error('Sign In Failed', message);
    localStorage.removeItem('oauthSignup');

    queueMicrotask(() => {
      cleanupUrl(location.pathname);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function cleanupUrl(pathname: string) {
  const params = new URLSearchParams(window.location.search);
  params.delete('error');
  params.delete('error_description');

  const newSearch = params.toString();
  const newUrl = newSearch ? `${pathname}?${newSearch}` : pathname;

  try {
    window.history.replaceState(null, '', newUrl);
  } catch (err) {
    console.warn('[useOAuthError] Failed to clean up URL:', err);
  }
}
