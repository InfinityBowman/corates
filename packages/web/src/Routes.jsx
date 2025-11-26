import { Router, Route } from '@solidjs/router';
import { Navigate } from '@solidjs/router';
import { Show } from 'solid-js';
import App from './App.jsx';
import SignIn from './auth-ui/SignIn.jsx';
import SignUp from './auth-ui/SignUp.jsx';
import CheckEmail from './auth-ui/CheckEmail.jsx';
import ResetPassword from './auth-ui/ResetPassword.jsx';
import AuthLayout from './components/AuthLayout.jsx';
import MainLayout from './components/MainLayout.jsx';
import AMSTAR2Checklist from './components/AMSTAR2Checklist.jsx';
import ChecklistYjsWrapper from './components/ChecklistYjsWrapper.jsx';
import UserYjsProvider from './components/UserYjsProvider.jsx';
import ProjectView from './components/ProjectView.jsx';
import { useBetterAuth } from './api/better-auth-store.js';

const API_BASE = import.meta.env.VITE_WORKER_API_URL || 'http://localhost:8787';

export const BASEPATH = import.meta.env.VITE_BASEPATH || '/';

// Component that provides authenticated user context to child routes
function AuthenticatedRoute(props) {
  const { user, authLoading, isLoggedIn } = useBetterAuth();

  return (
    <Show
      when={!authLoading() && isLoggedIn() && user()}
      fallback={
        <div class='min-h-screen bg-gray-900 flex items-center justify-center'>
          <div class='text-center text-white'>
            <div class='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto'></div>
            <p class='mt-4 text-gray-400'>Loading...</p>
          </div>
        </div>
      }
    >
      {props.children(user().id)}
    </Show>
  );
}

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

      {/* Authenticated routes wrapped with MainLayout and UserYjsProvider */}
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
            <AuthenticatedRoute>
              {userId => (
                <UserYjsProvider userId={userId} apiBase={API_BASE}>
                  <ProjectView userId={userId} />
                </UserYjsProvider>
              )}
            </AuthenticatedRoute>
          </MainLayout>
        )}
      />
      <Route
        path='/projects/:projectId/reviews/:reviewId/checklists/:checklistId'
        component={() => (
          <MainLayout>
            <AuthenticatedRoute>
              {userId => (
                <UserYjsProvider userId={userId} apiBase={API_BASE}>
                  <ChecklistYjsWrapper />
                </UserYjsProvider>
              )}
            </AuthenticatedRoute>
          </MainLayout>
        )}
      />

      <Route
        path='/dashboard'
        component={() => (
          <MainLayout>
            <AuthenticatedRoute>
              {userId => (
                <UserYjsProvider userId={userId} apiBase={API_BASE}>
                  <App />
                </UserYjsProvider>
              )}
            </AuthenticatedRoute>
          </MainLayout>
        )}
      />

      {/* Redirect root to dashboard */}
      <Route path='/' component={() => <Navigate href='/dashboard' />} />
    </Router>
  );
}
