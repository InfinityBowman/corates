import { Router, Route } from '@solidjs/router';
import { Navigate } from '@solidjs/router';
import App from './App.jsx';
import SignIn from './auth-ui/SignIn.jsx';
import SignUp from './auth-ui/SignUp.jsx';
import CheckEmail from './auth-ui/CheckEmail.jsx';
import ResetPassword from './auth-ui/ResetPassword.jsx';
import AuthLayout from './components/AuthLayout.jsx';
import MainLayout from './components/MainLayout.jsx';
import AMSTAR2Checklist from './components/AMSTAR2Checklist.jsx';
import ChecklistYjsWrapper from './components/ChecklistYjsWrapper.jsx';
import ProjectView from './components/ProjectView.jsx';

export const BASEPATH = import.meta.env.VITE_BASEPATH || '/';

export default function AppRoutes() {
  return (
    <Router base={BASEPATH}>
      {/* Auth routes */}
      <Route
        path='/signin'
        component={() => (
          <AuthLayout>
            <SignIn />
          </AuthLayout>
        )}
      />
      <Route
        path='/signup'
        component={() => (
          <AuthLayout>
            <SignUp />
          </AuthLayout>
        )}
      />
      <Route
        path='/check-email'
        component={() => (
          <AuthLayout>
            <CheckEmail />
          </AuthLayout>
        )}
      />
      <Route
        path='/reset-password'
        component={() => (
          <AuthLayout>
            <ResetPassword />
          </AuthLayout>
        )}
      />

      {/* Public routes - no auth required */}
      <Route
        path='/checklist'
        component={() => (
          <MainLayout>
            <AMSTAR2Checklist />
          </MainLayout>
        )}
      />
      <Route
        path='/projects/:projectId'
        component={() => (
          <MainLayout>
            <ProjectView />
          </MainLayout>
        )}
      />
      <Route
        path='/projects/:projectId/reviews/:reviewId/checklists/:checklistId'
        component={() => (
          <MainLayout>
            <ChecklistYjsWrapper />
          </MainLayout>
        )}
      />

      <Route
        path='/dashboard'
        component={() => (
          <MainLayout>
            <App />
          </MainLayout>
        )}
      />

      {/* Redirect root to dashboard */}
      <Route path='/' component={() => <Navigate href='/dashboard' />} />
    </Router>
  );
}
