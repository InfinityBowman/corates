// Custom client entry point -- StrictMode disabled.
// React 19's StrictMode double-invokes effects in dev, which destroys
// WebSocket connections (Yjs, notifications) during the cleanup phase
// before the re-mount can reclaim them.
import { StartClient } from '@tanstack/react-start/client';
import { hydrateRoot } from 'react-dom/client';
import { initSentry } from '@/config/sentry';

initSentry();

hydrateRoot(document, <StartClient />);
