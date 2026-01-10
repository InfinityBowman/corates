import { lazy } from 'solid-js';
import { Route } from '@solidjs/router';
import AdminLayout from '@/components/admin/AdminLayout.jsx';

// Lazy-load all admin page components
const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard.jsx'));
const StorageManagement = lazy(() => import('@/components/admin/StorageManagement.jsx'));
const OrgList = lazy(() => import('@/components/admin/OrgList.jsx'));
const OrgDetail = lazy(() => import('@/components/admin/OrgDetail.jsx'));
const AdminBillingLedgerPage = lazy(
  () => import('@/components/admin/billing-observability/AdminBillingLedgerPage.jsx'),
);
const AdminBillingStuckStatesPage = lazy(
  () => import('@/components/admin/billing-observability/AdminBillingStuckStatesPage.jsx'),
);
const DatabaseViewer = lazy(() => import('@/components/admin/DatabaseViewer.jsx'));
const UserDetail = lazy(() => import('@/components/admin/UserDetail.jsx'));
const ProjectList = lazy(() => import('@/components/admin/ProjectList.jsx'));
const ProjectDetail = lazy(() => import('@/components/admin/ProjectDetail.jsx'));
const StripeToolsPage = lazy(
  () => import('@/components/admin/billing-observability/StripeToolsPage.jsx'),
);

/**
 * Admin routes - returns Route elements for the /admin/* path.
 * This entire module is lazy-loaded when /admin/* is first visited.
 */
export default function AdminRoutes() {
  return (
    <Route path='/' component={AdminLayout}>
      <Route path='/' component={AdminDashboard} />
      <Route path='/orgs' component={OrgList} />
      <Route path='/orgs/:orgId' component={OrgDetail} />
      <Route path='/users/:userId' component={UserDetail} />
      <Route path='/projects' component={ProjectList} />
      <Route path='/projects/:projectId' component={ProjectDetail} />
      <Route path='/storage' component={StorageManagement} />
      <Route path='/billing/ledger' component={AdminBillingLedgerPage} />
      <Route path='/billing/stuck-states' component={AdminBillingStuckStatesPage} />
      <Route path='/billing/stripe-tools' component={StripeToolsPage} />
      <Route path='/database' component={DatabaseViewer} />
    </Route>
  );
}
