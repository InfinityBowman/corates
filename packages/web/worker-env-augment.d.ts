// Augments Cloudflare.Env with secrets and vars consumed by the web worker.
// These bindings live in web's .env (dev) and Cloudflare dashboard (prod).
declare namespace Cloudflare {
  interface Env {
    AUTH_SECRET: string;
    /** Bearer token for /api/sync-admin (wrangler secret put SYNC_ADMIN_TOKEN). */
    SYNC_ADMIN_TOKEN?: string;
    EMAIL_FROM: string;
    POSTMARK_SERVER_TOKEN: string;
    SEND_EMAILS_IN_DEV?: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    ORCID_CLIENT_ID: string;
    ORCID_CLIENT_SECRET: string;
    STRUCTURED_LOGS?: string;
    ADMIN_EMAIL: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET_AUTH: string;
    STRIPE_WEBHOOK_SECRET_PURCHASES: string;
    CF_VERSION_METADATA?: WorkerVersionMetadata;
  }
}
