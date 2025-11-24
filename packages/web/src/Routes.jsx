import { Router, Route } from '@solidjs/router';
import { Navigate } from '@solidjs/router';
import App from './App.jsx';
import SignIn from './auth-ui/SignIn.jsx';
import SignUp from './auth-ui/SignUp.jsx';
import CheckEmail from './auth-ui/CheckEmail.jsx';
import VerifyEmail from './auth-ui/VerifyEmail.jsx';
import ResetPassword from './auth-ui/ResetPassword.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AuthLayout from './components/AuthLayout.jsx';

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
      <Route
        path='/verify-email'
        component={() => (
          <AuthLayout>
            <VerifyEmail />
          </AuthLayout>
        )}
      />

      {/* Protected dashboard route */}
      <Route
        path='/dashboard'
        component={() => (
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        )}
      />

      {/* Redirect root to signup */}
      <Route path='/' component={() => <Navigate href='/signup' />} />
    </Router>
  );
}
