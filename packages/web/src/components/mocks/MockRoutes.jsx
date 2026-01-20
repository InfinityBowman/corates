import { lazy } from 'solid-js';
import { Route } from '@solidjs/router';

// MockIndex loads immediately (it's the landing page for mocks)
import MockIndex from './MockIndex.jsx';

// Lazy-load all mock page components
const ProjectViewEditorial = lazy(() => import('./ProjectViewEditorial.jsx'));
const ProjectViewDashboard = lazy(() => import('./ProjectViewDashboard.jsx'));
const ProjectViewKanban = lazy(() => import('./ProjectViewKanban.jsx'));
const ProjectViewComplete = lazy(() => import('./ProjectViewComplete.jsx'));
const DashboardMock = lazy(() => import('./DashboardMock.jsx'));
const ReactivePropsDemo = lazy(() => import('./ReactivePropsDemo.jsx'));
const ProjectWizardMock = lazy(() => import('./ProjectWizardMock.jsx'));
const ProjectViewV2 = lazy(() => import('./ProjectViewV2.jsx'));

/**
 * Mock routes - returns Route elements for the /mocks/* path.
 * This entire module is lazy-loaded when /mocks/* is first visited.
 */
export default function MockRoutes() {
  return (
    <Route path='/mocks'>
      <Route path='/' component={MockIndex} />
      <Route path='/project-view-editorial' component={ProjectViewEditorial} />
      <Route path='/project-view-dashboard' component={ProjectViewDashboard} />
      <Route path='/project-view-kanban' component={ProjectViewKanban} />
      <Route path='/project-view-complete' component={ProjectViewComplete} />
      <Route path='/dashboard' component={DashboardMock} />
      <Route path='/reactivity-example' component={ReactivePropsDemo} />
      <Route path='/project-wizard' component={ProjectWizardMock} />
      <Route path='/project-view-v2' component={ProjectViewV2} />
    </Route>
  );
}
