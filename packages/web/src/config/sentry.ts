/**
 * Sentry Configuration
 * Frontend error monitoring setup with React integration
 */

import * as Sentry from '@sentry/react';
import type { SeverityLevel } from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

interface CaptureContext {
  component?: string;
  action?: string;
  [key: string]: unknown;
}

/**
 * Initialize Sentry on the browser. Safe to call multiple times; subsequent
 * calls are ignored if Sentry is already initialized.
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    return;
  }
  if (Sentry.getClient()) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    sendDefaultPii: true,
  });
}

/**
 * Capture an exception with optional context
 */
export function captureException(error: unknown, context: CaptureContext = {}): void {
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
export function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context: CaptureContext = {},
): void {
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
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  return !!SENTRY_DSN;
}
