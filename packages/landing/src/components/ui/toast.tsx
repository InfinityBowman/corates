/**
 * Toast notification system (React stub)
 *
 * Minimal implementation providing the showToast API used by lib/error-utils.js
 * and other utility modules. Will be replaced with full Ark UI implementation
 * when UI components are migrated (Phase 2).
 *
 * TODO(agent): Replace with full Ark UI React toast implementation
 */

// Deduplication: Track recent toasts to prevent spam
const recentToasts = new Map<string, number>();
const DEDUP_WINDOW_MS = 2000;

function getToastKey(title: string, description?: string, type?: string): string {
  return `${type || 'info'}:${title}:${description || ''}`;
}

function shouldShowToast(title: string, description?: string, type?: string): boolean {
  const key = getToastKey(title, description, type);
  const now = Date.now();
  const lastShown = recentToasts.get(key);

  if (lastShown && now - lastShown < DEDUP_WINDOW_MS) {
    return false;
  }

  recentToasts.set(key, now);

  // Clean up old entries periodically
  if (recentToasts.size > 50) {
    for (const [k, t] of recentToasts) {
      if (now - t > DEDUP_WINDOW_MS * 2) {
        recentToasts.delete(k);
      }
    }
  }

  return true;
}

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

function createToast(title: string, description?: string, type: ToastType = 'info') {
  if (!shouldShowToast(title, description, type)) return;

  // Console-based fallback until full toast UI is migrated
  const prefix = `[${type.toUpperCase()}]`;
  if (type === 'error') {
    console.error(prefix, title, description || '');
  } else if (type === 'warning') {
    console.warn(prefix, title, description || '');
  } else {
    console.info(prefix, title, description || '');
  }

  return crypto.randomUUID();
}

export const showToast = {
  success: (title: string, description?: string) => createToast(title, description, 'success'),
  error: (title: string, description?: string) => createToast(title, description, 'error'),
  warning: (title: string, description?: string) => createToast(title, description, 'warning'),
  info: (title: string, description?: string) => createToast(title, description, 'info'),
  loading: (title: string, description?: string) => createToast(title, description, 'loading'),
  dismiss: (_id?: string) => {
    // No-op until full toast UI is migrated
  },
};

/**
 * Placeholder ToasterContainer - renders nothing until full migration
 */
export function ToasterContainer() {
  return null;
}
