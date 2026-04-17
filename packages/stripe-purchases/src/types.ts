import type { EmailPayload } from './lib/email-queue';

export interface Env {
  ENVIRONMENT: 'development' | 'production';
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET_PURCHASES: string;
  EMAIL_QUEUE: Queue<EmailPayload>;
}
