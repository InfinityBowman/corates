/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

function getApiBase(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:8787';
}

export const API_BASE = getApiBase();
export const LANDING_URL: string = import.meta.env.VITE_PUBLIC_APP_URL;
export const BASEPATH: string = import.meta.env.VITE_BASEPATH;

export function getWsBaseUrl(apiBase: string = API_BASE): string {
  const wsProtocol = apiBase.startsWith('https') ? 'wss' : 'ws';
  const wsHost = apiBase.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${wsHost}`;
}
