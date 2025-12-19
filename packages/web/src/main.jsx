import { render } from 'solid-js/web';
import './global.css';
import Routes from './Routes.jsx';
import { cleanupExpiredStates } from '@lib/formStatePersistence.js';

// Clean up any expired form state entries from IndexedDB on app load
// eslint-disable-next-line unicorn/prefer-top-level-await
cleanupExpiredStates().catch(() => {
  // Silent fail - cleanup is best-effort
});

function Root() {
  return <Routes />;
}

render(() => <Root />, document.querySelector('#root'));
