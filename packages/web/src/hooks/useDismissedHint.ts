import { useEffect, useEffectEvent, useState } from 'react';
import { parseUserPreferences, type HintId } from '@corates/shared';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { dismissHint as dismissHintOnServer } from '@/server/functions/users.functions';

// The server list is what follows the user across devices. localStorage is
// only an optimistic copy so the hint hides on click and does not flash on
// the next load before the session refetches.
function readLocal(key: string) {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeLocal(key: string) {
  try {
    localStorage.setItem(key, 'true');
  } catch {
    // Private browsing can refuse writes; the server copy still hides it next visit
  }
}

export function useDismissedHint(hintId: HintId) {
  const user = useAuthStore(selectUser);
  const sessionRefetch = useAuthStore(state => state.sessionRefetch);
  const userId = user?.id;
  // Same key the pre-sync build wrote, so existing dismissals carry over
  const storageKey = `${hintId}Dismissed:${userId ?? 'anonymous'}`;

  const serverDismissed = parseUserPreferences(user?.preferences).dismissedHints.includes(hintId);
  const [localDismissed, setLocalDismissed] = useState(() => readLocal(storageKey));

  const persist = () =>
    dismissHintOnServer({ data: { hintId } })
      // Bypass the cookie cache so the store sees the new list right away
      .then(() => sessionRefetch?.({ disableCookieCache: true }))
      .catch(err => console.warn('[hints] Failed to save dismissal:', err));

  // A dismissal this device knows about but the server does not was either
  // made before dismissals synced or failed to save; send it up once per mount
  const syncLocalDismissal = useEffectEvent(() => {
    if (localDismissed && !serverDismissed) persist();
  });
  useEffect(() => {
    if (userId) syncLocalDismissal();
  }, [userId, hintId]);

  const dismiss = () => {
    setLocalDismissed(true);
    writeLocal(storageKey);
    persist();
  };

  return { dismissed: serverDismissed || localDismissed, dismiss };
}
