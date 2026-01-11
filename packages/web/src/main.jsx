import { render } from 'solid-js/web';
import './global.css';
import Routes from './Routes.jsx';
import { cleanupExpiredStates } from '@lib/formStatePersistence.js';
import { initBfcacheHandler } from '@lib/bfcache-handler.js';
import AppErrorBoundary from './components/ErrorBoundary.jsx';
import { QueryClientProvider } from '@tanstack/solid-query';
import { queryClient } from '@lib/queryClient.js';
import { bestEffort } from '@lib/errorLogger.js';

// Clean up any expired form state entries from IndexedDB on app load
bestEffort(cleanupExpiredStates(), { operation: 'cleanupExpiredStates' });

// Initialize bfcache restoration handler
// This detects when Safari (and other browsers) restore pages from bfcache
// and refreshes auth session and project list to ensure state is current
initBfcacheHandler();

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <Routes />
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

render(() => <Root />, document.getElementById('root'));
