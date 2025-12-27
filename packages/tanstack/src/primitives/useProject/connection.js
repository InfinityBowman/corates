/**
 * Connection management for Y.js WebSocket sync using y-websocket
 * Uses WebsocketProvider for built-in reconnection, sync protocol, and awareness
 */

import { WebsocketProvider } from 'y-websocket'
import { getWsBaseUrl } from '@config/api.js'
import projectStore from '@/stores/projectStore.js'

/**
 * Close reason codes for WebSocket disconnection
 * These match the reasons sent by the backend ProjectDoc DO
 */
export const CLOSE_REASONS = {
  PROJECT_DELETED: 'project-deleted',
  MEMBERSHIP_REVOKED: 'membership-revoked',
  NOT_A_MEMBER: 'not-a-member',
}

/**
 * Creates a connection manager for WebSocket sync
 * @param {string} projectId - The project ID
 * @param {Y.Doc} ydoc - The Y.js document
 * @param {Object} options - Configuration options
 * @param {Function} options.onSync - Called when sync completes
 * @param {Function} options.isLocalProject - Returns if this is a local-only project
 * @param {Function} options.onAccessDenied - Called when access is denied (removed, deleted, not a member)
 * @returns {Object} Connection manager API
 */
export function createConnectionManager(projectId, ydoc, options) {
  const { onSync, isLocalProject, onAccessDenied } = options

  let provider = null
  let lastErrorLog = 0
  let consecutiveErrors = 0
  const ERROR_LOG_THROTTLE = 5000 // Only log errors every 5 seconds
  const MAX_CONSECUTIVE_ERRORS = 5 // Stop reconnecting after this many failures

  // Track if we intend to be connected (for online/offline handling)
  let shouldBeConnected = false

  // Handle online/offline events
  function handleOnline() {
    // When coming back online, reconnect if we should be connected
    if (shouldBeConnected && provider && !provider.wsconnected) {
      provider.connect()
    }
  }

  function handleOffline() {
    // Pause reconnection attempts when offline
    if (provider) {
      provider.shouldConnect = false
    }
  }

  // Set up listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  function connect() {
    if (!ydoc || isLocalProject()) return

    // Don't attempt connection when offline
    if (!navigator.onLine) {
      shouldBeConnected = true // Remember we want to be connected when online
      return
    }

    shouldBeConnected = true

    const wsUrl = `${getWsBaseUrl()}/api/project`

    provider = new WebsocketProvider(wsUrl, projectId, ydoc, {
      connect: false, // Don't connect until listeners are attached
      // WebsocketProvider handles reconnection automatically with exponential backoff
    })

    provider.on('status', ({ status }) => {
      projectStore.setConnectionState(projectId, {
        connected: status === 'connected',
        connecting: status === 'connecting',
      })

      // Reset error count on successful connection
      if (status === 'connected') {
        consecutiveErrors = 0
      }
    })

    provider.on('sync', (isSynced) => {
      if (isSynced && onSync) onSync()
    })

    // Check if already synced (in case sync happened before listener was attached)
    // and then connect
    if (provider.synced && onSync) {
      onSync()
    }

    // Now connect after all listeners are attached
    provider.connect()

    provider.on('connection-close', (event, provider) => {
      // event can be null when disconnect() is called programmatically
      if (!event) return

      const reason = event.reason || ''

      // Handle project deletion - server closed connection because project was deleted
      if (reason === CLOSE_REASONS.PROJECT_DELETED) {
        projectStore.setConnectionState(projectId, {
          error: 'This project has been deleted',
          connected: false,
          connecting: false,
        })
        provider.shouldConnect = false
        shouldBeConnected = false
        if (onAccessDenied) {
          onAccessDenied({ reason: CLOSE_REASONS.PROJECT_DELETED })
        }
        return
      }

      // Handle membership revocation - user was removed from project while connected
      if (reason === CLOSE_REASONS.MEMBERSHIP_REVOKED) {
        projectStore.setConnectionState(projectId, {
          error: 'You have been removed from this project',
          connected: false,
          connecting: false,
        })
        provider.shouldConnect = false
        shouldBeConnected = false
        if (onAccessDenied) {
          onAccessDenied({ reason: CLOSE_REASONS.MEMBERSHIP_REVOKED })
        }
        return
      }

      // Handle membership rejection (1008 = Policy Violation) or generic "not a member"
      if (
        event.code === 1008 ||
        reason.includes('member') ||
        reason === CLOSE_REASONS.NOT_A_MEMBER
      ) {
        projectStore.setConnectionState(projectId, {
          error: 'You are not a member of this project',
          connected: false,
          connecting: false,
        })
        // Prevent auto-reconnect for membership issues
        provider.shouldConnect = false
        shouldBeConnected = false
        if (onAccessDenied) {
          onAccessDenied({ reason: CLOSE_REASONS.NOT_A_MEMBER })
        }
        return
      }

      // When offline, don't let the provider try to reconnect
      if (!navigator.onLine) {
        provider.shouldConnect = false
      }
    })

    provider.on('connection-error', () => {
      // Suppress error logging when offline to prevent console spam
      if (!navigator.onLine) {
        return
      }

      consecutiveErrors++

      // Throttle error logs to prevent console spam
      const now = Date.now()
      if (now - lastErrorLog > ERROR_LOG_THROTTLE) {
        console.error('WebSocket connection error')
        lastErrorLog = now
      }

      // After too many consecutive errors, stop trying to reconnect
      // This handles cases where project was deleted or user doesn't have access
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        projectStore.setConnectionState(projectId, {
          error:
            'Unable to connect to project. It may have been deleted or you may not have access.',
          connected: false,
          connecting: false,
        })
        provider.shouldConnect = false
        shouldBeConnected = false
        if (onAccessDenied) {
          onAccessDenied({ reason: 'connection-failed' })
        }
        return
      }

      projectStore.setConnectionState(projectId, {
        error: 'Connection error',
        connected: false,
        connecting: false,
      })
    })
  }

  function disconnect() {
    shouldBeConnected = false
    if (provider) {
      provider.destroy()
      provider = null
    }
    projectStore.setConnectionState(projectId, {
      connected: false,
      connecting: false,
    })
  }

  function destroy() {
    disconnect()
    // Clean up event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }

  function reconnect() {
    if (!navigator.onLine) return // Don't reconnect when offline

    if (provider) {
      provider.disconnect()
      provider.connect()
    } else {
      connect()
    }
  }

  function getAwareness() {
    return provider?.awareness
  }

  function getProvider() {
    return provider
  }

  // For compatibility with existing code
  function getShouldReconnect() {
    return provider?.shouldConnect ?? false
  }

  function setShouldReconnect(value) {
    if (provider) {
      provider.shouldConnect = value
    }
    shouldBeConnected = value
  }

  return {
    connect,
    disconnect,
    destroy,
    reconnect,
    getAwareness,
    getProvider,
    getShouldReconnect,
    setShouldReconnect,
  }
}
