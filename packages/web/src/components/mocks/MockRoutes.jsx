import { lazy } from 'solid-js';
import { Route } from '@solidjs/router';

// MockIndex loads immediately (it's the landing page for mocks)
import MockIndex from './MockIndex.jsx';

// Lazy-load all mock page components
const ProjectViewEditorial = lazy(() => import('./ProjectViewEditorial.jsx'));
const ProjectViewDashboard = lazy(() => import('./ProjectViewDashboard.jsx'));
const ProjectViewKanban = lazy(() => import('./ProjectViewKanban.jsx'));
const ProjectViewComplete = lazy(() => import('./ProjectViewComplete.jsx'));
const AddStudiesWizard = lazy(() => import('./AddStudiesWizard.jsx'));
const AddStudiesPanel = lazy(() => import('./AddStudiesPanel.jsx'));
const AddStudiesInline = lazy(() => import('./AddStudiesInline.jsx'));
const SettingsMockBento = lazy(() => import('./SettingsMockBento.jsx'));
const SettingsMockMinimal = lazy(() => import('./SettingsMockMinimal.jsx'));
const SettingsMockCombined = lazy(() => import('./SettingsMockCombined.jsx'));
const DashboardMock = lazy(() => import('./DashboardMock.jsx'));
const ReactivePropsDemo = lazy(() => import('./ReactivePropsDemo.jsx'));

/**
 * Mock routes - returns Route elements for the /mocks/* path.
 * This entire module is lazy-loaded when /mocks/* is first visited.
 */
export default function MockRoutes() {
  return (
    <>
      <Route path='/' component={MockIndex} />
      <Route path='/project-view-editorial' component={ProjectViewEditorial} />
      <Route path='/project-view-dashboard' component={ProjectViewDashboard} />
      <Route path='/project-view-kanban' component={ProjectViewKanban} />
      <Route path='/project-view-complete' component={ProjectViewComplete} />
      <Route path='/add-studies-wizard' component={AddStudiesWizard} />
      <Route path='/add-studies-panel' component={AddStudiesPanel} />
      <Route path='/add-studies-inline' component={AddStudiesInline} />
      <Route path='/settings-bento' component={SettingsMockBento} />
      <Route path='/settings-minimal' component={SettingsMockMinimal} />
      <Route path='/settings-combined' component={SettingsMockCombined} />
      <Route path='/dashboard' component={DashboardMock} />
      <Route path='/reactivity-example' component={ReactivePropsDemo} />
    </>
  );
}
