// Cloudflare drops the previous build's hashed chunks the moment a deploy lands,
// so a tab opened before the deploy fails to import any chunk it has not loaded yet.
const STALE_CHUNK_MESSAGE_PREFIXES = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'Unable to preload CSS',
];

export function isStaleChunkError(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message;
  return (
    typeof message === 'string' &&
    STALE_CHUNK_MESSAGE_PREFIXES.some(prefix => message.startsWith(prefix))
  );
}

// One reload per failing chunk per tab, so a chunk that is genuinely gone surfaces
// as an error instead of a reload loop. Returns whether a reload was started.
export function reloadOnceForStaleChunk(error: unknown): boolean {
  const key = `stale-chunk-reload:${(error as { message?: string } | null)?.message ?? ''}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
