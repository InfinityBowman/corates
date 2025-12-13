/**
 * Impersonation Banner - Shows when admin is impersonating a user
 */

import { Show, onMount } from 'solid-js';
import { FiAlertTriangle, FiLogOut } from 'solid-icons/fi';
import {
  isImpersonating,
  stopImpersonation,
  checkImpersonationStatus,
} from '@/stores/adminStore.js';

export default function ImpersonationBanner() {
  // Check impersonation status on mount
  onMount(async () => {
    await checkImpersonationStatus();
  });

  const handleStopImpersonation = async () => {
    try {
      await stopImpersonation();
    } catch (err) {
      console.error('Failed to stop impersonation:', err);
    }
  };

  return (
    <Show when={isImpersonating()}>
      <div class='fixed top-0 left-0 right-0 z-100 bg-orange-500 text-white px-4 py-2'>
        <div class='max-w-7xl mx-auto flex items-center justify-between'>
          <div class='flex items-center space-x-2'>
            <FiAlertTriangle class='w-5 h-5' />
            <span class='font-medium'>You are currently impersonating a user</span>
          </div>
          <button
            onClick={handleStopImpersonation}
            class='flex items-center space-x-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium transition'
          >
            <FiLogOut class='w-4 h-4' />
            <span>Stop Impersonating</span>
          </button>
        </div>
      </div>
    </Show>
  );
}
