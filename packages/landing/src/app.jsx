import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { MetaProvider } from '@solidjs/meta';
import { onMount, Suspense } from 'solid-js';
import './styles.css';

import { checkSession } from '~/lib/auth';
import DefaultSeo from '~/components/DefaultSeo';

export default function App() {
  onMount(() => {
    checkSession();
  });

  return (
    <Router
      root={props => (
        <MetaProvider>
          <DefaultSeo />
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
