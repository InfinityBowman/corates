/**
 * Sentry Configuration
 * Frontend error monitoring setup
 */

import * as Sentry from '@sentry/browser';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ENVIRONMENT = import.meta.env.MODE || 'development';

/**
 * Initialize Sentry for frontend error monitoring
 * Call this early in app initialization (before render)
 */
export function initSentry() {
  // Only initialize if DSN is configured
  if (!SENTRY_DSN) {
    if (ENVIRONMENT === 'development') {
      console.info('[Sentry] No DSN configured, skipping initialization');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,

    // Capture 100% of errors
    // Adjust in production if volume is high
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Don't send PII by default
    sendDefaultPii: false,

    // Filter out common noise
    ignoreErrors: [
      // Browser extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // Network errors that are usually transient
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // ResizeObserver noise
      'ResizeObserver loop',
    ],

    // Add context before sending
    beforeSend(event) {
      // Don't send in development unless explicitly enabled
      if (ENVIRONMENT === 'development' && !import.meta.env.VITE_SENTRY_DEV) {
        console.info('[Sentry] Would send event:', event);
        return null;
      }
      return event;
    },
  });

  console.info('[Sentry] Initialized for', ENVIRONMENT);
}

/**
 * Capture an exception with optional context
 */
export function captureException(error, context = {}) {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.captureException(error, {
    tags: {
      component: context.component,
      action: context.action,
    },
    extra: context,
  });
}

/**
 * Capture a message with optional context
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.captureMessage(message, {
    level,
    tags: {
      component: context.component,
      action: context.action,
    },
    extra: context,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user) {
  if (!SENTRY_DSN) {
    return;
  }

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled() {
  return !!SENTRY_DSN;
}

export { Sentry };
