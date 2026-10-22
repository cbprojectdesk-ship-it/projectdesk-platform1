# Standalone Cloudflare deployment — security boundary

**Status: BLOCKED; do not press Deploy in Cloudflare's Git import wizard.**

This repository's `platform/` application is built for OpenAI Sites managed hosting, not a standalone Cloudflare Worker. The `platform/.openai/hosting.json` file declares D1 binding `DB`, but is not a production Wrangler deployment configuration or a database ID. The Vite config uses a placeholder D1 ID for local development. `build/sites-worker.ts` delegates to the Sites runtime; `server/api.mjs` relies on trusted `oai-authenticated-user-*` identity headers injected by the managed dispatch. Publicly routing requests to that Worker without a verified authentication boundary would allow identity spoofing.

## Required engineering changes before standalone hosting

1. Implement a production authentication provider with verified sessions (secure HttpOnly cookies, CSRF protection, login/logout, email verification and account recovery). Replace the managed identity header contract with server-verified principal derivation, rejecting any caller-provided identity headers. Add cross-tenant and unauthenticated integration tests. Never enable the local Sites mock sign-in in production.
2. Define a standalone Cloudflare Worker deployment configuration for the actual build output, D1 binding `DB` with the **real** account database ID, compatibility settings and any required assets/services. Validate with an isolated staging deployment and preserve the existing Sites path.
3. Create and apply reviewed D1 schema migrations to staging, verify transactional writes and independently tested backup/restore. Do not use the all-zero placeholder database ID.
4. Add secrets in the hosting dashboard, not the repository. Keep `QUENVIRA_BILLING_MODE=test` and `QUENVIRA_SELF_SERVE=no`. Set the verified HTTPS origin and the Stripe test webhook signing secret only after a reachable deployment exists.
5. Restrict Stripe Billing Portal plan switching to the implemented Starter plan. Verify test Checkout, trial, webhook signatures and replay protection, renewal, payment failure, portal cancellation and account access after expiry.
6. Complete incident response, monitoring, privacy/legal, accessibility and real-browser acceptance gates before accepting real customers.

Run `node platform/scripts/standalone-cloudflare-preflight.mjs` from the repository root for a fail-closed readiness reminder. Environment gate flags are declarations only, **not evidence of verification**; the script must not be used as a substitute for a security review.

## Current Cloudflare wizard

Repository: `cbprojectdesk-ship-it/projectdesk-platform1`; source directory: `platform/`. **Do not** use the default `npx wrangler deploy` against the repository root, and do not invent a build/deploy command until the standalone authentication and D1 configuration are implemented and tested.

The existing hosted webhook smoke test is in PR #20. It is not a complete payment verification and requires an actual HTTPS origin.
