// @refresh reload
import { mount, StartClient } from '@solidjs/start/client';

// Register service worker for offline support
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker
//       .register('/sw.js', { updateViaCache: 'none' })
//       .then(registration => {
//         // If there's already an updated SW waiting, activate it.
//         if (registration.waiting) {
//           registration.waiting.postMessage({ type: 'SKIP_WAITING' });
//         }

//         registration.addEventListener('updatefound', () => {
//           const installingWorker = registration.installing;
//           if (!installingWorker) return;

//           installingWorker.addEventListener('statechange', () => {
//             // When a new SW has installed and there's an existing controller,
//             // it means this is an update (not first install). Activate it.
//             if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
//               installingWorker.postMessage({ type: 'SKIP_WAITING' });
//             }
//           });
//         });
//       })
//       .catch(error => {
//         console.error('Service worker registration failed:', error);
//       });

//     // Reload once the new SW takes control so fresh HTML/assets are used.
//     navigator.serviceWorker.addEventListener('controllerchange', () => {
//       window.location.reload();
//     });
//   });
// }

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('Service worker unregistered:', registration);
      }

      // Clear caches created by the SW
      // if ('caches' in window) {
      //   const cacheNames = await caches.keys();
      //   await Promise.all(cacheNames.map(name => caches.delete(name)));
      //   console.log('Caches cleared');
      // }
    } catch (error) {
      console.error('Error unregistering service workers:', error);
    }
  });
}

mount(() => <StartClient />, document.querySelector('#app'));
