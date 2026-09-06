/**
 * Toast notification adapter over Sonner
 *
 * Provides the showToast API used by lib/error-utils.ts and other utility
 * modules. Backed by Sonner (installed via shadcn).
 *
 * Mount <Toaster /> once in the app root (from @/components/ui/sonner).
 * Call showToast.success/error/warning/info/loading/dismiss from anywhere.
 */

import { toast } from 'sonner';

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

  if (recentToasts.size > 50) {
    for (const [k, t] of recentToasts) {
      if (now - t > DEDUP_WINDOW_MS * 2) {
        recentToasts.delete(k);
      }
    }
  }

  return true;
}

export const showToast = {
  success: (title: string, description?: string) => {
    if (!shouldShowToast(title, description, 'success')) return;
    return toast.success(title, { description, duration: 3000 });
  },
  error: (title: string, description?: string) => {
    if (!shouldShowToast(title, description, 'error')) return;
    return toast.error(title, { description, duration: 5000 });
  },
  warning: (title: string, description?: string) => {
    if (!shouldShowToast(title, description, 'warning')) return;
    return toast.warning(title, { description, duration: 3000 });
  },
  info: (title: string, description?: string) => {
    if (!shouldShowToast(title, description, 'info')) return;
    return toast.info(title, { description, duration: 3000 });
  },
  loading: (title: string, description?: string) => {
    // Loading toasts bypass deduplication and persist until dismissed
    return toast.loading(title, { description, duration: Infinity });
  },
  dismiss: (id?: string | number) => {
    if (id !== undefined) {
      toast.dismiss(id);
    } else {
      toast.dismiss();
    }
  },
};
