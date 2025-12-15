import { Router, Route } from '@solidjs/router';
import Dashboard from './components/Dashboard.jsx';
import SignIn from '@auth-ui/SignIn.jsx';
import SignUp from '@auth-ui/SignUp.jsx';
import CheckEmail from '@auth-ui/CheckEmail.jsx';
import CompleteProfile from '@auth-ui/CompleteProfile.jsx';
import ResetPassword from '@auth-ui/ResetPassword.jsx';
import AuthLayout from '@auth-ui/AuthLayout.jsx';
import Layout from '@/Layout.jsx';
import ChecklistYjsWrapper from '@checklist-ui/ChecklistYjsWrapper.jsx';
import ReconciliationWrapper from '@/components/checklist-ui/compare/ReconciliationWrapper.jsx';
import ProjectView from '@project-ui/ProjectView.jsx';
import LocalChecklistView from '@checklist-ui/LocalChecklistView.jsx';
import ProfilePage from '@components/profile-ui/ProfilePage.jsx';
import SettingsPage from '@components/profile-ui/SettingsPage.jsx';
import BillingPage from '@components/billing/BillingPage.jsx';
import NotFoundPage from '@components/NotFoundPage.jsx';
import { AdminDashboard } from '@components/admin-ui/index.js';
import { BASEPATH } from '@config/api.js';
import ProtectedGuard from '@/components/auth-ui/ProtectedGuard.jsx';

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
        <Route path='/' component={Dashboard} />
        <Route path='/dashboard' component={Dashboard} />
        {/* Protected routes - requires login */}
        <Route path='/' component={ProtectedGuard}>
          <Route path='/profile' component={ProfilePage} />
          <Route path='/settings' component={SettingsPage} />
          <Route path='/admin' component={AdminDashboard} />
          <Route path='/settings/billing' component={BillingPage} />
        </Route>
        <Route path='/checklist/*' component={LocalChecklistView} />
        <Route path='/checklist/:checklistId' component={LocalChecklistView} />
        <Route path='/projects/:projectId' component={ProjectView} />
        <Route
          path='/projects/:projectId/studies/:studyId/checklists/:checklistId'
          component={ChecklistYjsWrapper}
        />
        <Route
          path='/projects/:projectId/studies/:studyId/reconcile/:checklist1Id/:checklist2Id'
          component={ReconciliationWrapper}
        />
      </Route>
      <Route path='*' component={NotFoundPage} />
    </Router>
  );
}
