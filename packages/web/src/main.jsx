import { render } from 'solid-js/web';
import './global.css';
import Routes from './Routes.jsx';
import { cleanupExpiredStates } from '@lib/formStatePersistence.js';
import { initBfcacheHandler } from '@lib/bfcache-handler.js';
import AppErrorBoundary from './components/ErrorBoundary.jsx';

// Clean up any expired form state entries from IndexedDB on app load
cleanupExpiredStates().catch(() => {
  // Silent fail - cleanup is best-effort
});

// Initialize bfcache restoration handler
// This detects when Safari (and other browsers) restore pages from bfcache
// and refreshes auth session and project list to ensure state is current
initBfcacheHandler();

function Root() {
  return (
    <AppErrorBoundary>
      <Routes />
    </AppErrorBoundary>
  );
}

render(() => <Root />, document.getElementById('root'));
