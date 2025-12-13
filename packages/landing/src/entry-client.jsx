// @refresh reload
import { mount, StartClient } from '@solidjs/start/client';

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.error('Service worker registration failed:', error);
    });
  });
}

mount(() => <StartClient />, document.getElementById('app'));
