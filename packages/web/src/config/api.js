/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

export const API_BASE = import.meta.env.VITE_WORKER_API_URL;

export const LANDING_URL = import.meta.env.VITE_LANDING_URL;

export const BASEPATH = import.meta.env.VITE_BASEPATH;

/**
 * Get WebSocket URL from API base
 * @returns {string} WebSocket base URL
 */
export function getWsBaseUrl() {
  const wsProtocol = API_BASE.startsWith('https') ? 'wss' : 'ws';
  const wsHost = API_BASE.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${wsHost}`;
}
