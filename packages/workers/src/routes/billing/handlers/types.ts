/**
 * Shared types for webhook handlers
 *
 * Uses loose typing to maintain compatibility with the existing webhookRouter.ts
 * which passes context with `unknown` types for db and env.
 */

export interface WebhookLogger {
  stripe: (event: string, data: Record<string, unknown>) => void;
  error?: (message: string, data: Record<string, unknown>) => void;
}

export interface WebhookContext {
  db: unknown;
  logger: WebhookLogger;
  env: unknown;
}

export interface WebhookResult {
  handled: boolean;
  result: string;
  ledgerContext?: Record<string, unknown>;
  error?: string;
}
