import { lazy } from 'solid-js';
import { Route } from '@solidjs/router';

// MockIndex loads immediately (it's the landing page for mocks)
import MockIndex from './MockIndex.jsx';

// Lazy-load all mock page components
const ProjectViewComplete = lazy(() => import('./ProjectViewComplete.jsx'));
const DashboardMock = lazy(() => import('./DashboardMock.jsx'));
const ReactivePropsDemo = lazy(() => import('./ReactivePropsDemo.jsx'));
const ProjectViewV2 = lazy(() => import('./ProjectViewV2.jsx'));
const AnimatedIconsDemo = lazy(() => import('./AnimatedIconsDemo.tsx'));

/**
 * Mock routes - returns Route elements for the /mocks/* path.
 * This entire module is lazy-loaded when /mocks/* is first visited.
 */
export default function MockRoutes() {
  return (
    <Route path='/mocks'>
      <Route path='/' component={MockIndex} />
      <Route path='/project-view-complete' component={ProjectViewComplete} />
      <Route path='/dashboard' component={DashboardMock} />
      <Route path='/reactivity-example' component={ReactivePropsDemo} />
      <Route path='/project-view-v2' component={ProjectViewV2} />
      <Route path='/animated-icons' component={AnimatedIconsDemo} />
    </Route>
  );
}
