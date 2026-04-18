/**
 * Corates Stripe Purchases Worker
 *
 * Isolated worker for Stripe purchase webhooks. Kept separate from the main app
 * worker for deploy-cadence isolation: frontend rebuilds must not risk disrupting
 * payment webhook retry windows or signature verification.
 *
 * Only route served: POST /api/billing/purchases/webhook
 * Everything else returns 404.
 */
import { Hono } from 'hono';
import { webhookRoutes } from './routes/webhook';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

app.route('/api/billing', webhookRoutes);

export default app;
