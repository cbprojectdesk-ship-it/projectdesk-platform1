# Stripe sandbox handoff — 22 October 2026

Stripe account: CCS Creative Technologies sandbox (test mode only).

## Existing implementation
The production-candidate backend already includes `server/subscriptions.mjs` with authenticated checkout, 14-day trial, portal, signed webhooks and server-side entitlement enforcement. Do not replace this with client-only payment status or a success-page trust check.

## Stripe objects created in sandbox
- Starter product `prod_VU888rxSugP0En`
- **Configured code-compatible Starter price:** `price_1UT9u1JMLR8T7SStIPxJ4aTy` — GBP 19.00 monthly, tax_behavior inclusive.
- Growth product `prod_VU88kCUrrXXJh5`, test price `price_1UT9sPJMLR8T7SStL07MiIgY` (£39 monthly).
- Professional product `prod_VU88xXt20kIPCw`, test price `price_1UT9sRJMLR8T7SStsxHUJPQM` (£79 monthly).
- Customer portal configuration `bpc_1UT9sgJMLR8T7SStvLOSiTss`: invoice history, payment method update, period-end cancellation, price changes.

**Important:** The first Starter test price `price_1UT9sOJMLR8T7SStLVrWsFVT` had unspecified tax behavior. Do **not** use it with current code; `verifyPrice()` explicitly requires inclusive. Growth and Professional are provisional catalogue entries; current server code allows only the £19 Starter price. Do not advertise plan switching or publish other tiers until plan-aware authorization, entitlement, tests and commercial terms are implemented.

## Deployment environment (secrets must be stored in hosting secret manager)
```text
QUENVIRA_BILLING_MODE=test
STRIPE_RESTRICTED_KEY=<rk_test_... from Stripe, NEVER commit>
STRIPE_WEBHOOK_SECRET=<whsec_... from configured test webhook, NEVER commit>
STRIPE_PRICE_ID=price_1UT9u1JMLR8T7SStIPxJ4aTy
STRIPE_PORTAL_CONFIGURATION=bpc_1UT9sgJMLR8T7SStvLOSiTss
QUENVIRA_TERMS_VERSION=2026-10-22
QUENVIRA_SITE_ORIGIN=<verified HTTPS application origin, no trailing slash>
QUENVIRA_SELF_SERVE=no
```

Webhook endpoint: `https://<verified application origin>/api/quenvira/subscription-webhook`. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.paid and invoice.payment_failed. Verify the endpoint is publicly reachable through hosting routing, while the webhook handler remains signature-verified.

## Release gates
1. Verify hosted identity, tenant isolation and D1 persistence on deployed test origin.
2. Verify the Stripe test secret is securely injected and the webhook endpoint signature checks pass.
3. Test 14-day trial, Stripe-hosted Checkout, payment confirmation, account access, cancellation, failed payment, retries, webhook replay and late delivery. Do not trust redirect alone.
4. Check portal behavior: the portal currently permits price changes but code validates only one Starter price. Restrict portal to Starter until plan-aware implementation is complete.
5. Validate browser/device, accessibility, privacy terms, backup/restore, incident response and production invoicing requirements in `docs/RELEASE_STATUS.md`.
6. Keep `QUENVIRA_BILLING_MODE=test`; do not enable live or paid launch without passing gates. No real customer charges.

Stripe account connection through ChatGPT is **not** equivalent to deployment secrets being configured on the Quenvira hosting environment.
