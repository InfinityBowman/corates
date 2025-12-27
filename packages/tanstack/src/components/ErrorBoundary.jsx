/**
 * Error Boundary Component
 * Catches rendering errors and unknown/programmer errors
 * Uses SolidJS's built-in ErrorBoundary with normalized error handling
 */

import { ErrorBoundary as SolidErrorBoundary } from 'solid-js';
import { normalizeError } from '@corates/shared';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'solid-icons/fi';

/**
 * Safe navigation button that works both inside and outside Route context
 */
function SafeNavigateButton() {
  const handleNavigate = () => {
    // Use window.location as fallback - works everywhere
    window.location.href = '/dashboard';
  };

  return (
    <button
      onClick={handleNavigate}
      class='flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none'
    >
      <FiHome class='h-4 w-4' />
      Go Home
    </button>
  );
}

/**
 * Default error display component
 * Shows user-friendly error message with recovery options
 */
function ErrorDisplay(props) {
  // ErrorBoundary fallback receives (error, reset) as function parameters
  // Access props directly - these are not reactive in this context
  // eslint-disable-next-line solid/reactivity
  const error = props.error;
  // eslint-disable-next-line solid/reactivity
  const reset = props.reset;

  // Determine error type and message
  const isProgrammerError = error?.code === 'UNKNOWN_PROGRAMMER_ERROR';
  const isTransportError = error?.code?.startsWith('TRANSPORT_');

  // User-friendly messages
  const title =
    isProgrammerError ? 'Something went wrong'
    : isTransportError ? 'Connection Error'
    : 'An error occurred';

  const message =
    isProgrammerError ? 'An unexpected error occurred. Please try refreshing the page.'
    : isTransportError ? 'Unable to connect to the server. Please check your internet connection.'
    : error?.message || 'Something went wrong. Please try again.';

  return (
    <div class='flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12'>
      <div class='w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-lg'>
        <div class='mb-4 flex items-center gap-3'>
          <div class='flex h-10 w-10 items-center justify-center rounded-full bg-red-100'>
            <FiAlertTriangle class='h-5 w-5 text-red-600' />
          </div>
          <h2 class='text-lg font-semibold text-gray-900'>{title}</h2>
        </div>

        <p class='mb-6 text-sm text-gray-600'>{message}</p>

        <div class='flex flex-col gap-2 sm:flex-row'>
          {reset && (
            <button
              onClick={reset}
              class='flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none'
            >
              <FiRefreshCw class='h-4 w-4' />
              Try Again
            </button>
          )}
          <SafeNavigateButton />
        </div>

        {/* Show error details in development */}
        {import.meta.env.DEV && error?.code && (
          <details class='mt-4'>
            <summary class='cursor-pointer text-xs text-gray-500'>Error Details (Dev Only)</summary>
            <pre class='mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-800'>
              {JSON.stringify(error, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * App Error Boundary
 * Wraps SolidJS ErrorBoundary with normalized error handling
 * Logs unknown/programmer errors for monitoring
 *
 * @param {Object} props - Component props
 * @param {JSX.Element} props.children - Child components to wrap
 * @param {Function} [props.fallback] - Custom fallback component (receives error and reset)
 * @param {Function} [props.onError] - Callback when error is caught (receives normalized error)
 */
export default function AppErrorBoundary(props) {
  const handleError = (error, reset) => {
    // Normalize the error using our error system
    const normalizedError = normalizeError(error);

    // Log unknown/programmer errors for monitoring
    if (normalizedError.code?.startsWith('UNKNOWN_')) {
      console.error('Error Boundary caught unknown error:', normalizedError);
      // TODO: Send to error monitoring service (e.g., Sentry, LogRocket)
      // logErrorToService(normalizedError);
    }

    // Call custom error handler if provided
    if (props.onError) {
      props.onError(normalizedError, reset);
    }

    // Use custom fallback if provided, otherwise use default
    if (props.fallback) {
      return props.fallback(normalizedError, reset);
    }

    return <ErrorDisplay error={normalizedError} reset={reset} />;
  };

  return <SolidErrorBoundary fallback={handleError}>{props.children}</SolidErrorBoundary>;
}

/**
 * Simple error boundary wrapper for specific sections
 * Use this for smaller scoped error boundaries
 */
export function SectionErrorBoundary(props) {
  return (
    <AppErrorBoundary
      fallback={(error, reset) => (
        <div class='rounded-lg border border-red-200 bg-red-50 p-4'>
          <div class='mb-2 flex items-center gap-2'>
            <FiAlertTriangle class='h-5 w-5 text-red-600' />
            <h3 class='font-semibold text-red-900'>Error</h3>
          </div>
          <p class='mb-3 text-sm text-red-700'>{error.message || 'Something went wrong'}</p>
          {reset && (
            <button
              onClick={reset}
              class='rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
            >
              Try Again
            </button>
          )}
        </div>
      )}
      onError={props.onError}
    >
      {props.children}
    </AppErrorBoundary>
  );
}
