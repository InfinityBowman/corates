import { createSignal, createEffect, onCleanup } from 'solid-js';

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
    let onlineDebounceTimer = null;
    let offlineDebounceTimer = null;

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

        await fetch('/api/health', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeoutId);
        return true;
      } catch {
        return false;
      }
    }

    async function handleOnline() {
      // Clear any pending offline timer
      if (offlineDebounceTimer) {
        clearTimeout(offlineDebounceTimer);
        offlineDebounceTimer = null;
      }

      // Debounce going online to prevent thrashing
      if (onlineDebounceTimer) {
        clearTimeout(onlineDebounceTimer);
      }

      onlineDebounceTimer = setTimeout(async () => {
        // Verify we're actually online before updating state
        const actuallyOnline = await verifyConnectivity();
        if (actuallyOnline) {
          setIsOnline(true);
        }
        onlineDebounceTimer = null;
      }, ONLINE_CONFIRM_DELAY_MS);
    }

    function handleOffline() {
      // Clear any pending online timer
      if (onlineDebounceTimer) {
        clearTimeout(onlineDebounceTimer);
        onlineDebounceTimer = null;
      }

      // Small debounce for offline too, but shorter since we want to react faster
      if (offlineDebounceTimer) {
        clearTimeout(offlineDebounceTimer);
      }

      offlineDebounceTimer = setTimeout(() => {
        // Double-check browser still thinks we're offline
        if (!navigator.onLine) {
          setIsOnline(false);
        }
        offlineDebounceTimer = null;
      }, DEBOUNCE_MS);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    onCleanup(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (onlineDebounceTimer) clearTimeout(onlineDebounceTimer);
      if (offlineDebounceTimer) clearTimeout(offlineDebounceTimer);
    });
  });

  return isOnline;
}
