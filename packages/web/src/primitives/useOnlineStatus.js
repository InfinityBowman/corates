import { createSignal, createEffect, onCleanup } from 'solid-js';

export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);

  createEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    onCleanup(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  });

  return isOnline;
}
