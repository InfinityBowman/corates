/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

// Helper to get API base - can be overridden for testing
function getApiBase() {
  return import.meta.env.VITE_API_URL || 'http://localhost:8787';
}

export const API_BASE = getApiBase();
export const LANDING_URL = import.meta.env.VITE_PUBLIC_APP_URL;
export const BASEPATH = import.meta.env.VITE_BASEPATH;

/**
 * Get WebSocket URL from API base
 * @param {string} [apiBase] - Optional API base URL to use (for testing)
 * @returns {string} WebSocket base URL
 */
export function getWsBaseUrl(apiBase = API_BASE) {
  const wsProtocol = apiBase.startsWith('https') ? 'wss' : 'ws';
  const wsHost = apiBase.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${wsHost}`;
}
