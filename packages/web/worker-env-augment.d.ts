// Augments Cloudflare.Env with secrets and vars that are owned by
// packages/workers during the Phase 2 "build alongside" window. These
// bindings are referenced by code imported from @corates/workers. Marked
// optional so web-only code doesn't assume they're configured in web's
// own deployment yet — Phase 3 cutover transfers them to web's worker.
declare namespace Cloudflare {
  interface Env {
    AUTH_SECRET?: string;
    EMAIL_FROM?: string;
    POSTMARK_SERVER_TOKEN?: string;
    SEND_EMAILS_IN_DEV?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    ORCID_CLIENT_ID?: string;
    ORCID_CLIENT_SECRET?: string;
    ADMIN_EMAIL?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET_AUTH?: string;
    STRIPE_WEBHOOK_SECRET_PURCHASES?: string;
    STRIPE_PRICE_ID_STARTER_TEAM_MONTHLY?: string;
    STRIPE_PRICE_ID_STARTER_TEAM_YEARLY?: string;
    STRIPE_PRICE_ID_TEAM_MONTHLY?: string;
    STRIPE_PRICE_ID_TEAM_YEARLY?: string;
    STRIPE_PRICE_ID_UNLIMITED_TEAM_MONTHLY?: string;
    STRIPE_PRICE_ID_UNLIMITED_TEAM_YEARLY?: string;
    STRIPE_PRICE_ID_SINGLE_PROJECT?: string;
    CF_VERSION_METADATA?: WorkerVersionMetadata;
  }
}
