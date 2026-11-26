import { clientLogger } from '@/lib/clientLogger';

// Long enough that a normal connect or a brief network blip never logs.
export const SYNC_SLOW_MS = 30_000;

/**
 * Records a project that stays out of sync long enough for the person to
 * notice (client.sync.slow) and how long it took to come back
 * (client.sync.recovered). The server only sees the failed attempts, not
 * whether the person was left waiting.
 */
export function createSyncSlowLog(projectId: string) {
  let unsyncedSince: number | null = null;
  let reported = false;
  let hiddenWhileWaiting = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function noteHidden() {
    if (document.hidden) hiddenWhileWaiting = true;
  }

  function stopTimer() {
    clearTimeout(timer);
    timer = undefined;
    document.removeEventListener('visibilitychange', noteHidden);
  }

  return {
    update(synced: boolean) {
      if (!synced) {
        if (unsyncedSince !== null) return;
        unsyncedSince = Date.now();
        hiddenWhileWaiting = document.hidden;
        document.addEventListener('visibilitychange', noteHidden);
        timer = setTimeout(() => {
          reported = true;
          document.removeEventListener('visibilitychange', noteHidden);
          clientLogger.warn('client.sync.slow', {
            projectId,
            waitedMs: SYNC_SLOW_MS,
            online: navigator.onLine,
            // Background tabs defer this timer until the person returns, when
            // document.hidden already reads false, so remember any hidden spell.
            hidden: hiddenWhileWaiting || document.hidden,
          });
        }, SYNC_SLOW_MS);
        return;
      }
      if (unsyncedSince === null) return;
      if (reported) {
        clientLogger.info('client.sync.recovered', {
          projectId,
          waitedMs: Date.now() - unsyncedSince,
        });
      }
      stopTimer();
      unsyncedSince = null;
      reported = false;
    },
    dispose: stopTimer,
  };
}
