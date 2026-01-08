/**
 * useNotifications hook - Manages WebSocket connection for real-time user notifications
 */

import { createSignal, onCleanup, createEffect } from 'solid-js';
import { API_BASE } from '@config/api.js';

/**
 * Hook to connect to the user's notification WebSocket
 * @param {Function} userId - The user ID to connect notifications for
 * @param {Object} options - Configuration options
 * @param {Function} options.onNotification - Callback when a notification is received
 * @returns {Object} Connection state and notifications
 */
export function useNotifications(userId, options = {}) {
  const [connected, setConnected] = createSignal(false);
  const [notifications, setNotifications] = createSignal([]);

  let ws = null;
  let reconnectTimeout = null;
  let pingInterval = null;
  let pongTimeout = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_DELAY = 60000; // 1 minute max
  const PING_INTERVAL = 30000; // 30 seconds
  const PONG_TIMEOUT = 10000; // 10 seconds to receive pong

  // Track whether we should be connected (user intent)
  let shouldConnect = false;
  // Track if component is still mounted
  let isMounted = true;

  function connect() {
    // Guard against connecting when unmounted or already connected
    if (!isMounted || ws || !userId?.()) return;

    // Don't attempt connection when offline
    if (!navigator.onLine) {
      return;
    }

    shouldConnect = true;

    // Build WebSocket URL
    const wsProtocol = API_BASE.startsWith('https') ? 'wss' : 'ws';
    const wsHost = API_BASE.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}://${wsHost}/api/sessions/${userId()}`;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('[useNotifications] WebSocket construction failed', err);
      ws = null;
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      if (!isMounted) {
        ws?.close();
        return;
      }
      setConnected(true);
      reconnectAttempts = 0; // Reset on successful connection
      startPingPong();
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        // Handle pong responses - connection is healthy
        if (data.type === 'pong') {
          clearPongTimeout();
          return;
        }

        // Add to notifications list
        setNotifications(prev => [data, ...prev]);

        // Call the notification callback if provided
        if (options.onNotification) {
          options.onNotification(data);
        }
      } catch (err) {
        console.error('Error parsing notification:', err);
      }
    };

    ws.onclose = event => {
      setConnected(false);
      cleanup();
      ws = null;

      // Don't reconnect if we intentionally disconnected or unmounted
      if (!shouldConnect || !isMounted) return;

      // Don't reconnect if offline
      if (!navigator.onLine) return;

      // Check for specific close codes that shouldn't trigger reconnect
      // 1000 = normal closure, 1001 = going away (page navigation)
      if (event.code === 1000 || event.code === 1001) {
        return;
      }

      scheduleReconnect();
    };

    ws.onerror = event => {
      // Log error details to help debugging (only when online)
      if (navigator.onLine) {
        console.error('[useNotifications] Notification WebSocket error', event);
      }
      // Force close so onclose handler runs and triggers reconnection
      try {
        if (ws && ws.readyState !== WebSocket.CLOSED) ws.close();
      } catch (_e) {
        // ignore
      }
    };
  }

  function scheduleReconnect() {
    if (!shouldConnect || !isMounted || !navigator.onLine) return;

    // Clear any existing reconnect timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s... up to MAX_RECONNECT_DELAY
    // Start from 1s instead of 5s for faster initial reconnect
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectAttempts++;

    reconnectTimeout = setTimeout(() => {
      if (isMounted && shouldConnect && navigator.onLine) {
        connect();
      }
    }, delay);
  }

  function startPingPong() {
    // Clear any existing intervals
    cleanup();

    // Start keepalive ping
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));

        // Set up pong timeout - if we don't get pong, connection is dead
        pongTimeout = setTimeout(() => {
          console.warn('[useNotifications] Pong timeout - connection may be dead');
          // Force reconnect by closing the socket
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }

  function clearPongTimeout() {
    if (pongTimeout) {
      clearTimeout(pongTimeout);
      pongTimeout = null;
    }
  }

  function cleanup() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    clearPongTimeout();
  }

  // Handle online/offline events
  function handleOnline() {
    // When we come back online and should be connected, attempt reconnection
    if (shouldConnect && !ws && isMounted) {
      reconnectAttempts = 0; // Reset backoff when coming online
      connect();
    }
  }

  function handleOffline() {
    // Cancel any pending reconnection attempts when going offline
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  }

  // Handle visibility change - reconnect when tab becomes visible
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && shouldConnect && isMounted) {
      // Tab became visible - check if we need to reconnect
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reconnectAttempts = 0;
        connect();
      }
    }
  }

  // Set up event listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  function disconnect() {
    shouldConnect = false;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    cleanup();
    if (ws) {
      ws.close(1000, 'disconnect'); // Normal closure
      ws = null;
    }
    setConnected(false);
  }

  function clearNotifications() {
    setNotifications([]);
  }

  function dismissNotification(timestamp) {
    setNotifications(prev => prev.filter(n => n.timestamp !== timestamp));
  }

  // Auto-connect when userId changes (reactive)
  createEffect(() => {
    const uid = userId?.();
    if (uid && !ws && isMounted) {
      connect();
    } else if (!uid && ws) {
      disconnect();
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    isMounted = false;
    disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });

  return {
    connected,
    notifications,
    connect,
    disconnect,
    clearNotifications,
    dismissNotification,
  };
}

export default useNotifications;
