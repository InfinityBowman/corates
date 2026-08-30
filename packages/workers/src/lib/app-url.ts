/**
 * Build absolute app URLs for emails and other server-side links.
 *
 * BASEPATH is the runtime worker var (mirrors VITE_BASEPATH from the client build).
 * VITE_BASEPATH is kept as a fallback for environments that only set the secret.
 */

import type { Env } from '../types';

function readBasepath(env: Env): string {
  const envRecord = env as unknown as Record<string, string | undefined>;
  return envRecord.BASEPATH ?? envRecord.VITE_BASEPATH ?? '';
}

/** Normalized basepath segment without trailing slash (empty when root). */
export function getAppBasepath(env: Env): string {
  const basepath = readBasepath(env);
  if (!basepath || basepath === '/') return '';
  return basepath.replace(/\/$/, '');
}

/** Build an absolute URL under APP_URL + basepath. Path must start with `/`. */
export function buildAppUrl(env: Env, path: string): string {
  const appUrl = (env.APP_URL || 'https://corates.org').replace(/\/$/, '');
  const basepath = getAppBasepath(env);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${appUrl}${basepath}${normalizedPath}`;
}
