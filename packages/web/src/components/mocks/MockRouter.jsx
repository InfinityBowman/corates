import { lazy } from 'solid-js';
import { Route } from '@solidjs/router';

// MockIndex loads immediately (it's the index page)
import MockIndex from './MockIndex.jsx';

export default function MockRouter() {
  // Lazy-load pages inline so imports only execute when route matches
  return (
    <>
      <Route path='/mocks' component={MockIndex} />
      <Route
        path='/mocks/project-view-editorial'
        component={lazy(() => import('./ProjectViewEditorial.jsx'))}
      />
      <Route
        path='/mocks/project-view-dashboard'
        component={lazy(() => import('./ProjectViewDashboard.jsx'))}
      />
      <Route
        path='/mocks/project-view-kanban'
        component={lazy(() => import('./ProjectViewKanban.jsx'))}
      />
      <Route
        path='/mocks/project-view-complete'
        component={lazy(() => import('./ProjectViewComplete.jsx'))}
      />
      <Route
        path='/mocks/add-studies-wizard'
        component={lazy(() => import('./AddStudiesWizard.jsx'))}
      />
      <Route
        path='/mocks/add-studies-panel'
        component={lazy(() => import('./AddStudiesPanel.jsx'))}
      />
      <Route
        path='/mocks/add-studies-inline'
        component={lazy(() => import('./AddStudiesInline.jsx'))}
      />
      <Route
        path='/mocks/settings-bento'
        component={lazy(() => import('./SettingsMockBento.jsx'))}
      />
      <Route
        path='/mocks/settings-minimal'
        component={lazy(() => import('./SettingsMockMinimal.jsx'))}
      />
      <Route
        path='/mocks/settings-combined'
        component={lazy(() => import('./SettingsMockCombined.jsx'))}
      />
      <Route path='/mocks/dashboard' component={lazy(() => import('./DashboardMock.jsx'))} />
      <Route
        path='/mocks/reactivity-example'
        component={lazy(() => import('./ReactivePropsDemo.jsx'))}
      />
    </>
  );
}
