/**
 * useNotifications - WebSocket connection for real-time user notifications
 * Handles ping/pong keepalive, exponential backoff reconnection,
 * online/offline awareness, and visibility change reconnection.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '@/config/api.js';

const MAX_RECONNECT_DELAY = 60000;
const PING_INTERVAL = 30000;
const PONG_TIMEOUT = 10000;

interface NotificationData {
  type: string;
  timestamp?: number;
  [key: string]: unknown;
}

/* eslint-disable no-unused-vars */
interface UseNotificationsOptions {
  onNotification?: (data: NotificationData) => void;
}
/* eslint-enable no-unused-vars */

export function useNotifications(
  userId: string | null | undefined,
  options: UseNotificationsOptions = {},
) {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldConnectRef = useRef(false);
  const onNotificationRef = useRef(options.onNotification);

  // Keep callback ref current without re-triggering effects
  useEffect(() => {
    onNotificationRef.current = options.onNotification;
  }, [options.onNotification]);

  const clearPongTimeout = useCallback(() => {
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  const cleanupTimers = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    clearPongTimeout();
  }, [clearPongTimeout]);

  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    cleanupTimers();
    if (wsRef.current) {
      wsRef.current.close(1000, 'disconnect');
      wsRef.current = null;
    }
  }, [cleanupTimers]);

  // Main connect/disconnect effect
  useEffect(() => {
    if (!userId) {
      disconnect();
      return;
    }

    shouldConnectRef.current = true;

    function startPingPong() {
      cleanupTimers();
      pingIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
          pongTimeoutRef.current = setTimeout(() => {
            console.warn('[useNotifications] Pong timeout - connection may be dead');
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.close();
            }
          }, PONG_TIMEOUT);
        }
      }, PING_INTERVAL);
    }

    function scheduleReconnect() {
      if (!shouldConnectRef.current || !navigator.onLine) return;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), MAX_RECONNECT_DELAY);
      reconnectAttemptsRef.current++;

      reconnectTimeoutRef.current = setTimeout(() => {
        if (shouldConnectRef.current && navigator.onLine) {
          connect();
        }
      }, delay);
    }

    function connect() {
      if (wsRef.current || !shouldConnectRef.current || !navigator.onLine) return;

      const wsProtocol = API_BASE.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_BASE.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/sessions/${userId}`;

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        console.error('[useNotifications] WebSocket construction failed', err);
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (!shouldConnectRef.current) {
          ws.close();
          return;
        }
        setConnected(true);
        reconnectAttemptsRef.current = 0;
        startPingPong();
      };

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            clearPongTimeout();
            return;
          }
          setNotifications(prev => [data, ...prev]);
          onNotificationRef.current?.(data);
        } catch (err) {
          console.error('Error parsing notification:', err);
        }
      };

      ws.onclose = event => {
        setConnected(false);
        cleanupTimers();
        wsRef.current = null;
        if (!shouldConnectRef.current || !navigator.onLine) return;
        if (event.code === 1000 || event.code === 1001) return;
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (navigator.onLine) {
          console.error('[useNotifications] WebSocket error');
        }
        try {
          if (ws.readyState !== WebSocket.CLOSED) ws.close();
        } catch (_) {
          /* ignore */
        }
      };
    }

    connect();

    // Online/offline handlers
    const handleOnline = () => {
      if (shouldConnectRef.current && !wsRef.current) {
        reconnectAttemptsRef.current = 0;
        connect();
      }
    };
    const handleOffline = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldConnectRef.current) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reconnectAttemptsRef.current = 0;
          connect();
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      shouldConnectRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      cleanupTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, 'unmount');
        wsRef.current = null;
      }
      setConnected(false);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearNotifications = useCallback(() => setNotifications([]), []);
  const dismissNotification = useCallback(
    (timestamp: number) => setNotifications(prev => prev.filter(n => n.timestamp !== timestamp)),
    [],
  );

  return {
    connected,
    notifications,
    disconnect,
    clearNotifications,
    dismissNotification,
  };
}
