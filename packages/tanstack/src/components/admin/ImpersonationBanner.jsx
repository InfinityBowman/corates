/**
 * Impersonation Banner - Shows when admin is impersonating a user
 */

import { Show, onMount } from 'solid-js'
import { FiAlertTriangle, FiLogOut } from 'solid-icons/fi'
import {
  isImpersonating,
  stopImpersonation,
  checkImpersonationStatus,
} from '@/stores/adminStore.js'
import { Z_INDEX } from '@corates/ui'

export default function ImpersonationBanner() {
  // Check impersonation status on mount
  onMount(async () => {
    await checkImpersonationStatus()
  })

  const handleStopImpersonation = async () => {
    try {
      await stopImpersonation()
    } catch (err) {
      console.error('Failed to stop impersonation:', err)
    }
  }

  return (
    <Show when={isImpersonating()}>
      <div
        class={`fixed top-0 right-0 left-0 ${Z_INDEX.BANNER} bg-orange-500 px-4 py-2 text-white`}
      >
        <div class="mx-auto flex max-w-7xl items-center justify-between">
          <div class="flex items-center space-x-2">
            <FiAlertTriangle class="h-5 w-5" />
            <span class="font-medium">
              You are currently impersonating a user
            </span>
          </div>
          <button
            onClick={handleStopImpersonation}
            class="flex items-center space-x-2 rounded-lg bg-orange-600 px-3 py-1 text-sm font-medium transition hover:bg-orange-700"
          >
            <FiLogOut class="h-4 w-4" />
            <span>Stop Impersonating</span>
          </button>
        </div>
      </div>
    </Show>
  )
}
