// Custom client entry point -- StrictMode disabled.
// React 19's StrictMode double-invokes effects in dev, which destroys
// WebSocket connections (Yjs, notifications) during the cleanup phase
// before the re-mount can reclaim them.
import { StartClient } from '@tanstack/react-start/client';
import { hydrateRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { initSentry } from '@/config/sentry';
import { reloadOnceForStaleChunk } from '@/lib/staleChunk';

initSentry();

// Route components already reload themselves on a missing chunk (TanStack Router);
// this covers React.lazy, inline import() calls, and CSS preloads.
window.addEventListener('vite:preloadError', event => {
  if (reloadOnceForStaleChunk(event.payload)) event.preventDefault();
});

hydrateRoot(document, <StartClient />, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
});
