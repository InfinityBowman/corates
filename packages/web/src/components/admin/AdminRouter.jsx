import { Route } from '@solidjs/router';
import { lazy } from 'solid-js';

export default function AdminRouter() {
  // Lazy-load layout and pages only when route is matched
  return (
    <Route path='/admin' component={lazy(() => import('@/components/admin/AdminLayout.jsx'))}>
      <Route path='/' component={lazy(() => import('@/components/admin/AdminDashboard.jsx'))} />
      <Route path='/orgs' component={lazy(() => import('@/components/admin/OrgList.jsx'))} />
      <Route
        path='/orgs/:orgId'
        component={lazy(() => import('@/components/admin/OrgDetail.jsx'))}
      />
      <Route
        path='/users/:userId'
        component={lazy(() => import('@/components/admin/UserDetail.jsx'))}
      />
      <Route
        path='/projects/*'
        component={lazy(() => import('@/components/admin/ProjectList.jsx'))}
      />
      <Route
        path='/projects/:projectId'
        component={lazy(() => import('@/components/admin/ProjectDetail.jsx'))}
      />
      <Route
        path='/storage'
        component={lazy(() => import('@/components/admin/StorageManagement.jsx'))}
      />
      <Route
        path='/billing/ledger'
        component={lazy(
          () => import('@/components/admin/billing-observability/AdminBillingLedgerPage.jsx'),
        )}
      />
      <Route
        path='/billing/stuck-states'
        component={lazy(
          () => import('@/components/admin/billing-observability/AdminBillingStuckStatesPage.jsx'),
        )}
      />
      <Route
        path='/billing/stripe-tools'
        component={lazy(
          () => import('@/components/admin/billing-observability/StripeToolsPage.jsx'),
        )}
      />
      <Route
        path='/database'
        component={lazy(() => import('@/components/admin/DatabaseViewer.jsx'))}
      />
    </Route>
  );
}
