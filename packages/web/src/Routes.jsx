import { Router, Route } from '@solidjs/router';
import Dashboard from './Dashboard.jsx';
import SignIn from '@auth-ui/SignIn.jsx';
import SignUp from '@auth-ui/SignUp.jsx';
import CheckEmail from '@auth-ui/CheckEmail.jsx';
import ResetPassword from '@auth-ui/ResetPassword.jsx';
import AuthLayout from '@auth-ui/AuthLayout.jsx';
import MainLayout from '@components/MainLayout.jsx';
import HomePage from '@components/HomePage.jsx';
import AMSTAR2Checklist from '@checklist-ui/AMSTAR2Checklist.jsx';
import ChecklistYjsWrapper from '@checklist-ui/ChecklistYjsWrapper.jsx';
import ProjectView from '@project-ui/ProjectView.jsx';
import LocalChecklistView from '@checklist-ui/LocalChecklistView.jsx';

export const BASEPATH = import.meta.env.VITE_BASEPATH || '/';

export default function AppRoutes() {
  return (
    <Router base={BASEPATH}>
      {/* Auth routes */}
      <Route path='/' component={AuthLayout}>
        <Route path='/signin' component={SignIn} />
        <Route path='/signup' component={SignUp} />
        <Route path='/check-email' component={CheckEmail} />
        <Route path='/reset-password' component={ResetPassword} />
      </Route>

      {/* Main app routes */}
      <Route path='/' component={MainLayout}>
        <Route path='/' component={HomePage} />
        <Route path='/dashboard' component={Dashboard} />
        <Route path='/checklist' component={AMSTAR2Checklist} />
        <Route path='/checklist/:checklistId' component={LocalChecklistView} />
        <Route path='/projects/:projectId' component={ProjectView} />
        <Route
          path='/projects/:projectId/reviews/:reviewId/checklists/:checklistId'
          component={ChecklistYjsWrapper}
        />
      </Route>
    </Router>
  );
}
