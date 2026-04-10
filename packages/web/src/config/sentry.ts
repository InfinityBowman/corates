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
