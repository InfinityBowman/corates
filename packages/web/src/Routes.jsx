import { Router, Route } from '@solidjs/router';
import { lazy } from 'solid-js';
import Dashboard from './components/dashboard/index.js';
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
import NotFoundPage from '@components/NotFoundPage.jsx';
import {
  SettingsLayout,
  SettingsIndex,
  ProfileSettings,
  IntegrationsSettings,
  BillingSettings,
  PlansSettings,
  SecuritySettings,
  NotificationsSettings,
} from '@/components/settings/index.js';
import { BASEPATH } from '@config/api.js';
import ProtectedGuard from '@/components/auth/ProtectedGuard.jsx';
import ProjectView from '@/components/project/ProjectView.jsx';
import { CreateOrgPage } from '@/components/org/index.js';

// Lazy-loaded route modules (only load when path matches)
const AdminRoutes = lazy(() => import('@/components/admin/AdminRoutes.jsx'));
const MockRoutes = lazy(() => import('@/components/mocks/MockRoutes.jsx'));

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
          {/* Settings routes with settings sidebar */}
          <Route path='/settings' component={SettingsLayout}>
            <Route path='/' component={SettingsIndex} />
            <Route path='/profile' component={ProfileSettings} />
            <Route path='/integrations' component={IntegrationsSettings} />
            <Route path='/billing' component={BillingSettings} />
            <Route path='/plans' component={PlansSettings} />
            <Route path='/security' component={SecuritySettings} />
            <Route path='/notifications' component={NotificationsSettings} />
          </Route>
          {/* Admin routes - fully code-split, only loads on /admin/* */}
          <AdminRoutes />
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
        <Route path='/checklist' component={LocalChecklistView} />
        <Route path='/checklist/:checklistId' component={LocalChecklistView} />
        {/* Mock routes - fully code-split, only loads on /mocks/* */}
        <MockRoutes />
      </Route>
      <Route path='*' component={NotFoundPage} />
    </Router>
  );
}
