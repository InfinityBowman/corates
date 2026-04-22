// Augments Cloudflare.Env with secrets and vars consumed by the web worker.
// These bindings live in web's .env (dev) and Cloudflare dashboard (prod).
declare namespace Cloudflare {
  interface Env {
    AUTH_SECRET: string;
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
    STRIPE_PRICE_ID_STARTER_TEAM_MONTHLY: string;
    STRIPE_PRICE_ID_STARTER_TEAM_YEARLY: string;
    STRIPE_PRICE_ID_TEAM_MONTHLY: string;
    STRIPE_PRICE_ID_TEAM_YEARLY: string;
    STRIPE_PRICE_ID_UNLIMITED_TEAM_MONTHLY: string;
    STRIPE_PRICE_ID_UNLIMITED_TEAM_YEARLY: string;
    STRIPE_PRICE_ID_SINGLE_PROJECT: string;
    CF_VERSION_METADATA?: WorkerVersionMetadata;
  }
}
