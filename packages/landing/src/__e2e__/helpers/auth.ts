/**
 * Auth helpers for e2e tests
 * Manages session cookies and browser state cleanup
 */

export function injectSessionCookie(token: string) {
  // Better Auth uses 'better-auth.session_token' cookie
  document.cookie = `better-auth.session_token=${token};path=/;`;
}

export async function clearBrowserState() {
  // Clear all cookies
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0].trim();
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });

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
