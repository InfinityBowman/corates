/**
 * Hook to handle OAuth errors from URL params
 *
 * Better Auth redirects to errorCallbackURL with ?error=<code> on OAuth failures.
 * This hook parses the error, shows a toast notification, and cleans up the URL.
 *
 * Usage:
 *   import { useOAuthError } from '@/primitives/useOAuthError.js';
 *
 *   function SignIn() {
 *     useOAuthError();
 *     // ... rest of component
 *   }
 */

import { onMount } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { parseOAuthError } from '@/lib/account-linking-errors.js';
import { showToast } from '@/components/ui/toast';

/**
 * Parse and handle OAuth errors from URL params
 * Shows a toast with user-friendly message and cleans up the URL
 */
export function useOAuthError() {
  const navigate = useNavigate();
  const location = useLocation();

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const parsedError = parseOAuthError(params);

    if (!parsedError) return;

    const { message } = parsedError;

    // Silent errors (user cancelled) - clean up URL and oauthSignup flag without notification
    if (message === null) {
      localStorage.removeItem('oauthSignup');
      cleanupUrl(navigate, location);
      return;
    }

    // Show error toast with user-friendly message
    showToast.error('Sign In Failed', message);

    // Clear any OAuth signup flags that might have been set
    localStorage.removeItem('oauthSignup');

    // Clean up URL params after microtask to ensure toast is registered first
    queueMicrotask(() => {
      cleanupUrl(navigate, location);
    });
  });
}

/**
 * Remove error params from URL without triggering navigation
 * Uses History API as primary method for reliability
 */
function cleanupUrl(_navigate, location) {
  const params = new URLSearchParams(window.location.search);

  // Remove error-related params
  params.delete('error');
  params.delete('error_description');

  // Reconstruct URL without error params
  const newSearch = params.toString();
  const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;

  // Use History API directly to avoid potential router re-render issues
  try {
    window.history.replaceState(null, '', newUrl);
  } catch (err) {
    console.warn('[useOAuthError] Failed to clean up URL:', err);
  }
}

export default useOAuthError;
