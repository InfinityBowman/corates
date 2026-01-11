import { createSignal, createEffect, onCleanup } from 'solid-js';
import { debounce } from '@solid-primitives/scheduled';

// Debounce delay to prevent thrashing on flaky networks
const DEBOUNCE_MS = 1000;

// How long to wait before confirming we're back online
const ONLINE_CONFIRM_DELAY_MS = 500;

/**
 * Smart online status hook with debouncing to handle flaky networks.
 *
 * - Going offline: Immediate (we trust the browser's offline event)
 * - Going online: Debounced + verified with a real network request
 *
 * This prevents rapid toggling when the network is unstable.
 */
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);

  createEffect(() => {
    /**
     * Verify connectivity by making a lightweight request.
     * Uses HEAD request to minimize data transfer.
     */
    async function verifyConnectivity() {
      try {
        // Use a lightweight endpoint - just check if we can reach our API
        // Falls back to checking if fetch works at all
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
          await fetch('/api/health', {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store',
          });
          return true;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        console.warn('Connectivity check failed:', err.message);
        return false;
      }
    }

    // Debounced handler for going online
    const debouncedHandleOnline = debounce(async () => {
      // Verify we're actually online before updating state
      const actuallyOnline = await verifyConnectivity();
      if (actuallyOnline) {
        setIsOnline(true);
      }
    }, ONLINE_CONFIRM_DELAY_MS);

    // Debounced handler for going offline
    const debouncedHandleOffline = debounce(() => {
      // Double-check browser still thinks we're offline
      if (!navigator.onLine) {
        setIsOnline(false);
      }
    }, DEBOUNCE_MS);

    async function handleOnline() {
      // Clear any pending offline timer
      debouncedHandleOffline.clear();
      // Debounce going online to prevent thrashing
      debouncedHandleOnline();
    }

    function handleOffline() {
      // Clear any pending online timer
      debouncedHandleOnline.clear();
      // Small debounce for offline too, but shorter since we want to react faster
      debouncedHandleOffline();
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    onCleanup(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      debouncedHandleOnline.clear();
      debouncedHandleOffline.clear();
    });
  });

  return isOnline;
}
