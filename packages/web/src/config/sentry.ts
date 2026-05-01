import * as Sentry from '@sentry/react';
import type { SeverityLevel } from '@sentry/react';
import type { Router } from '@tanstack/react-router';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

interface CaptureContext {
  component?: string;
  action?: string;
  [key: string]: unknown;
}

export function initSentry(): void {
  if (!SENTRY_DSN || Sentry.getClient()) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    replaysSessionSampleRate: import.meta.env.DEV ? 0 : 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      Sentry.feedbackIntegration({
        colorScheme: 'system',
        autoInject: false,
      }),
    ],
  });
}

// Wire up TanStack Router tracing after the router is created.
// Called from router.tsx where the instance is available.
export function initSentryRouterTracing(router: Router<never, never>): void {
  if (!SENTRY_DSN || !Sentry.getClient()) return;
  Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router as never));
}

export function setSentryUser(user: { id: string; email?: string; name?: string } | null): void {
  if (!SENTRY_DSN) return;
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email, username: user.name });
  } else {
    Sentry.setUser(null);
  }
}

export function captureException(error: unknown, context: CaptureContext = {}): void {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, {
    tags: { component: context.component, action: context.action },
    extra: context,
  });
}

export function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context: CaptureContext = {},
): void {
  if (!SENTRY_DSN) return;
  Sentry.captureMessage(message, {
    level,
    tags: { component: context.component, action: context.action },
    extra: context,
  });
}

export function isSentryEnabled(): boolean {
  return !!SENTRY_DSN;
}
