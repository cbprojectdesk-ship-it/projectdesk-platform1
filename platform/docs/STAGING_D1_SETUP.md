# Quenvira staging D1 configuration (not a deployment)

Database name: `quenvira-staging`
Database ID: `a91be5bb-6565-473e-98c2-40e83bc0e2d5`
Worker binding: `DB`

This is a **staging-only** identifier, not a secret. Do not replace the placeholder in `vite.config.ts`: that placeholder supports the existing managed/local environment. Do not publish the Worker until verified Cloudflare Access and a staging deployment configuration are in place.

## Dashboard binding

Once a private staging Worker exists, open Workers & Pages → that Worker → Settings → Bindings → Add → D1 database. Set variable name `DB` and select `quenvira-staging`. The Worker must run with `QUENVIRA_HOSTING_MODE=standalone` and correctly configured `QUENVIRA_ACCESS_TEAM_DOMAIN` and `QUENVIRA_ACCESS_AUDIENCE`; these are not yet configured or verified. Keep `QUENVIRA_BILLING_MODE=test` and `QUENVIRA_SELF_SERVE=no`.

## Migration safety

The database exists but has not been migrated. Review the SQL migrations under `platform/drizzle/` and verify the target database ID before executing any `wrangler d1 migrations apply quenvira-staging --remote` command from the `platform/` workspace with an appropriate Wrangler configuration. Do not run this command against an unreviewed configuration. Capture migration results and a tested backup/restore before customer data.

## Release gates

- [ ] Verify Access policy and real signed identity assertions; do not expose public Worker.
- [ ] Produce reviewed standalone Worker build/config and bind this staging D1.
- [ ] Apply and verify staging migrations, backup and restore.
- [ ] Test cross-tenant isolation and unauthorized access.
- [ ] Test hosted Stripe signed sandbox webhooks and subscriptions.
- [ ] Complete security, operational and legal launch review.
