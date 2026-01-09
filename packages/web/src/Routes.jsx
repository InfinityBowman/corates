import { Router, Route } from '@solidjs/router';
import { lazy } from 'solid-js';
import Dashboard from './components/Dashboard.jsx';
import SignIn from '@/components/auth/SignIn.jsx';
import SignUp from '@/components/auth/SignUp.jsx';
import CheckEmail from '@/components/auth/CheckEmail.jsx';
import CompleteProfile from '@/components/auth/CompleteProfile.jsx';
import ResetPassword from '@/components/auth/ResetPassword.jsx';
import AuthLayout from '@/components/auth/AuthLayout.jsx';
import Layout from '@/Layout.jsx';
import LocalChecklistView from '@/components/checklist/LocalChecklistView.jsx';
import ChecklistYjsWrapper from '@/components/checklist/ChecklistYjsWrapper.jsx';
import ReconciliationWrapper from '@/components/project/reconcile-tab/ReconciliationWrapper.jsx';
import ProfilePage from '@/components/profile/ProfilePage.jsx';
import NotFoundPage from '@components/NotFoundPage.jsx';
import {
  SettingsLayout,
  SettingsIndex,
  BillingSettings,
  PlansSettings,
  SecuritySettings,
  NotificationsSettings,
  GeneralSettings,
} from '@/components/settings/index.js';
import AdminLayout from '@/components/admin/AdminLayout.jsx';
import { BASEPATH } from '@config/api.js';
import ProtectedGuard from '@/components/auth/ProtectedGuard.jsx';
import ProjectView from '@/components/project/ProjectView.jsx';
import { CreateOrgPage } from '@/components/org/index.js';
import MockIndex from '@/components/mock/MockIndex.jsx';

// Code-split admin routes - loaded only when navigating to /admin/*
const AdminDashboard = lazy(() =>
  import('@/components/admin/index.js').then(m => ({ default: m.AdminDashboard })),
);
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

export default function AppRoutes() {
  return (
    <Router base={BASEPATH}>
      {/* Auth routes - AuthLayout includes guest guard logic */}
      <Route path='/' component={AuthLayout}>
        <Route path='/signin' component={SignIn} />
        <Route path='/signup' component={SignUp} />
        <Route path='/check-email' component={CheckEmail} />
        <Route path='/complete-profile' component={CompleteProfile} />
        <Route path='/reset-password' component={ResetPassword} />
      </Route>

      {/* Main app routes - Layout handles sidebar visibility based on route */}
      <Route path='/' component={Layout}>
        {/* Dashboard - public home for all users */}
        <Route path='/' component={Dashboard} />
        <Route path='/dashboard' component={Dashboard} />

        {/* Protected routes - requires login */}
        <Route path='/' component={ProtectedGuard}>
          {/* Global user routes (no sidebar) */}
          <Route path='/profile' component={ProfilePage} />
          {/* Settings routes with settings sidebar */}
          <Route path='/settings' component={SettingsLayout}>
            <Route path='/' component={SettingsIndex} />
            <Route path='/billing' component={BillingSettings} />
            <Route path='/plans' component={PlansSettings} />
            <Route path='/security' component={SecuritySettings} />
            <Route path='/notifications' component={NotificationsSettings} />
            <Route path='/general' component={GeneralSettings} />
          </Route>
          <Route path='/admin' component={AdminLayout}>
            <Route path='/' component={AdminDashboard} />
            <Route path='/orgs' component={OrgList} />
            <Route path='/orgs/:orgId' component={OrgDetail} />
            <Route path='/users/:userId' component={UserDetail} />
            <Route path='/projects/*' component={ProjectList} />
            <Route path='/projects/:projectId' component={ProjectDetail} />
            <Route path='/storage' component={StorageManagement} />
            <Route path='/billing/ledger' component={AdminBillingLedgerPage} />
            <Route path='/billing/stuck-states' component={AdminBillingStuckStatesPage} />
            <Route path='/billing/stripe-tools' component={StripeToolsPage} />
            <Route path='/database' component={DatabaseViewer} />
          </Route>
          {/* Organization creation */}
          <Route path='/orgs/new' component={CreateOrgPage} />
          {/* Project-scoped routes - checklist and reconcile are children sharing YDoc connection */}
          <Route path='/projects/:projectId' component={ProjectView}>
            {/* Empty path for ProjectView to render at /projects/:projectId */}
            <Route path='/' />
            <Route
              path='/studies/:studyId/checklists/:checklistId'
              component={ChecklistYjsWrapper}
            />
            <Route
              path='/studies/:studyId/reconcile/:checklist1Id/:checklist2Id'
              component={ReconciliationWrapper}
            />
          </Route>
        </Route>

        {/* Local checklists (not org-scoped, work offline) */}
        <Route path='/checklist/*' component={LocalChecklistView} />
        <Route path='/checklist/:checklistId' component={LocalChecklistView} />

        {/* Mock routes - public, visual-only wireframes */}
        <Route path='/mock' component={MockIndex} />
      </Route>
      <Route path='*' component={NotFoundPage} />
    </Router>
  );
}
