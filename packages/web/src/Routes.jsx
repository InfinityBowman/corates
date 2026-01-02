import { Router, Route } from '@solidjs/router';
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
import ReconciliationWrapper from '@/components/project/reconcile-tab/amstar2-reconcile/ReconciliationWrapper.jsx';
import ProfilePage from '@/components/profile/ProfilePage.jsx';
import SettingsPage from '@/components/profile/SettingsPage.jsx';
import BillingPage from '@components/billing/BillingPage.jsx';
import NotFoundPage from '@components/NotFoundPage.jsx';
import { AdminDashboard } from '@/components/admin/index.js';
import StorageManagement from '@/components/admin/StorageManagement.jsx';
import { BASEPATH } from '@config/api.js';
import ProtectedGuard from '@/components/auth/ProtectedGuard.jsx';
import ProjectView from '@/components/project/ProjectView.jsx';
import { CreateOrgPage } from '@/components/org/index.js';

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

      {/* Main app routes */}
      <Route path='/' component={Layout}>
        {/* Dashboard - public home for all users */}
        <Route path='/' component={Dashboard} />
        <Route path='/dashboard' component={Dashboard} />

        {/* Protected routes - requires login */}
        <Route path='/' component={ProtectedGuard}>
          {/* Global user routes */}
          <Route path='/profile' component={ProfilePage} />
          <Route path='/settings' component={SettingsPage} />
          <Route path='/admin' component={AdminDashboard} />
          <Route path='/admin/storage' component={StorageManagement} />
          <Route path='/settings/billing' component={BillingPage} />

          {/* Organization creation */}
          <Route path='/orgs/new' component={CreateOrgPage} />

          {/* Project-scoped routes */}
          <Route path='/projects/:projectId' component={ProjectView} />

          {/* Project-scoped checklist routes */}
          <Route
            path='/projects/:projectId/studies/:studyId/checklists/:checklistId'
            component={ChecklistYjsWrapper}
          />
          <Route
            path='/projects/:projectId/studies/:studyId/reconcile/:checklist1Id/:checklist2Id'
            component={ReconciliationWrapper}
          />
        </Route>

        {/* Local checklists (not org-scoped, work offline) */}
        <Route path='/checklist/*' component={LocalChecklistView} />
        <Route path='/checklist/:checklistId' component={LocalChecklistView} />
      </Route>
      <Route path='*' component={NotFoundPage} />
    </Router>
  );
}
