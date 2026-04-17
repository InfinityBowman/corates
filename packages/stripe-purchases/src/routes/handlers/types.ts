/**
 * Shared types for webhook handlers
 *
 * Uses loose typing to maintain compatibility with the existing webhookRouter.ts
 * which passes context with `unknown` types for db and env.
 */

export interface WebhookLogger {
  stripe: (_event: string, _data: Record<string, unknown>) => void;
  error?: (_message: string, _data: Record<string, unknown>) => void;
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
