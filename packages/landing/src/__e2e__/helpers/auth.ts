/**
 * Auth helpers for e2e tests
 * Manages session cookies and browser state cleanup
 */

import { commands } from 'vitest/browser';

/**
 * Inject session cookie via Playwright context (server-side).
 * This bypasses httpOnly restrictions that document.cookie can't handle.
 */
export async function injectSessionCookie(token: string) {
  await (commands as any).setCookies([
    {
      name: 'better-auth.session_token',
      value: token,
      domain: 'localhost',
      path: '/',
    },
  ]);
}

export async function clearBrowserState() {
  // Clear cookies via Playwright (server-side, handles httpOnly)
  await (commands as any).clearCookies();

  // Clear localStorage
  localStorage.clear();

  // Clear IndexedDB databases
  if ('databases' in indexedDB) {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  }
}
