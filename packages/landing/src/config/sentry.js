/**
 * Sentry Configuration
 * Frontend error monitoring setup with React integration
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ENVIRONMENT = import.meta.env.MODE || 'development';

/**
 * Initialize Sentry for frontend error monitoring
 * Call this early in app initialization (before render)
 */
export function initSentry() {
  if (!SENTRY_DSN) {
    if (ENVIRONMENT === 'development') {
      console.info('[Sentry] No DSN configured, skipping initialization');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,

    integrations: [Sentry.browserTracingIntegration()],

    // Capture 100% of errors in dev, sample in production
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    sendDefaultPii: false,

    ignoreErrors: [
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'ResizeObserver loop',
    ],

    beforeSend(event) {
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
