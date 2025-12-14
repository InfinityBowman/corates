import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { MetaProvider } from '@solidjs/meta';
import { onMount, Suspense } from 'solid-js';
import './styles.css';

import { checkSession } from '~/lib/auth';

export default function App() {
  onMount(() => {
    checkSession();
  });

  return (
    <Router
      root={props => (
        <MetaProvider>
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
