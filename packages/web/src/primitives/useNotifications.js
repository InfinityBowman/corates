/**
 * useNotifications hook - Manages WebSocket connection for real-time user notifications
 */

import { createSignal, onCleanup } from 'solid-js';
import { API_BASE } from '@config/api.js';

/**
 * Hook to connect to the user's notification WebSocket
 * @param {string} userId - The user ID to connect notifications for
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

  function connect() {
    if (ws || !userId) return;

    // Build WebSocket URL
    const wsProtocol = API_BASE.startsWith('https') ? 'wss' : 'ws';
    const wsHost = API_BASE.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}://${wsHost}/api/sessions/${userId}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      // Start keepalive ping
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        // Ignore pong responses
        if (data.type === 'pong') return;

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

    ws.onclose = () => {
      setConnected(false);
      cleanup();
      // Attempt to reconnect after 5 seconds
      reconnectTimeout = setTimeout(() => {
        connect();
      }, 5000);
    };

    ws.onerror = err => {
      console.error('Notification WebSocket error:', err);
      setConnected(false);
    };
  }

  function cleanup() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    cleanup();
    if (ws) {
      ws.close();
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

  // Cleanup on unmount
  onCleanup(() => {
    disconnect();
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
