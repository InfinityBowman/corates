/**
 * GoogleDriveSettings - Component for managing Google Drive connection in Settings
 */

import { createSignal, onMount, Show } from 'solid-js'
import { FiX } from 'solid-icons/fi'
import { showToast } from '@corates/ui'
import {
  getGoogleDriveStatus,
  disconnectGoogleDrive,
  connectGoogleAccount,
} from '@/api/google-drive.js'

export default function GoogleDriveSettings() {
  const [loading, setLoading] = createSignal(true)
  const [connected, setConnected] = createSignal(false)
  const [disconnecting, setDisconnecting] = createSignal(false)
  const [connecting, setConnecting] = createSignal(false)

  onMount(async () => {
    try {
      const status = await getGoogleDriveStatus()
      setConnected(status.connected)
    } catch (err) {
      console.error('Error checking Google Drive status:', err)
    } finally {
      setLoading(false)
    }
  })

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await connectGoogleAccount(window.location.href)
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js')
      await handleError(err, {
        toastTitle: 'Error',
      })
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) {
      return
    }

    setDisconnecting(true)

    try {
      await disconnectGoogleDrive()
      setConnected(false)
      showToast.success('Disconnected', 'Google account has been disconnected.')
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js')
      await handleError(err, {
        toastTitle: 'Error',
      })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-gray-100 p-2">
          <img src="/logos/drive.svg" alt="Google Drive" class="h-5 w-5" />
        </div>
        <div>
          <p class="font-medium text-gray-900">Google Drive</p>
          <p class="text-sm text-gray-500">
            {loading()
              ? 'Checking connection...'
              : connected()
                ? 'Connected - You can import PDFs from your Drive'
                : 'Connect to import PDFs from Google Drive'}
          </p>
        </div>
      </div>

      <Show when={!loading()}>
        <Show
          when={connected()}
          fallback={
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting()}
              class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <img src="/logos/drive.svg" alt="Google Drive" class="h-4 w-4" />
              {connecting() ? 'Connecting...' : 'Connect'}
            </button>
          }
        >
          <div class="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting()}
              class="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <FiX class="h-4 w-4" />
              {disconnecting() ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </Show>
      </Show>
    </div>
  )
}
