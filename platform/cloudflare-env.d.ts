declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    QUENVIRA_PILOT_EMAILS?: string;
    QUENVIRA_BILLING_MODE?: string;
    QUENVIRA_HOSTING_MODE?: string;
    QUENVIRA_ACCESS_TEAM_DOMAIN?: string;
    QUENVIRA_ACCESS_AUDIENCE?: string;
    STRIPE_RESTRICTED_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_LIVE_RESTRICTED_KEY?: string;
    STRIPE_LIVE_WEBHOOK_SECRET?: string;
    QUENVIRA_LIVE_WEBHOOK_VERIFY?: string;
    STRIPE_PRICE_ID?: string;
    STRIPE_PORTAL_CONFIGURATION?: string;
    QUENVIRA_TERMS_VERSION?: string;
    QUENVIRA_SITE_ORIGIN?: string;
    QUENVIRA_SELF_SERVE?: string;
    QUENVIRA_PAID_LAUNCH_APPROVED?: string;
  }
}
