# Subscription release candidate — 22 October 2026

## Delivered and intentionally inactive

A server-only Stripe SDK integration now implements fixed-price hosted Checkout, Customer Portal, signed raw-body lifecycle webhooks, stable customer/checkout idempotency, a once-only 14-day no-card app trial, and server-enforced editing entitlements. No live products, Checkout Sessions, customer charges or subscription contracts were created. Public preview and existing pilot membership continue while billing mode is absent/disabled.

The approved sage/gold interface and logo remain. Managers have a Subscription & billing entry in Settings. Staff have no billing controls or billing API access. A checkout return page is informational only. Checkout price/customer IDs and return origins come from server configuration/mappings, never from the browser. UK £19 total monthly licensed price is verified against Stripe before checkout; it must be configured with inclusive tax behavior, GBP, quantity one and one-month recurrence. Tax collection remains off pending confirmed VAT treatment. No VAT registration is inferred.

The local app trial is anchored on first enrolled workspace creation, not each browser visit or checkout. Deleting/recreating the same initial workspace does not restart it. Managers who choose checkout with more than 48 hours remaining keep its original end date. During the final 48 hours they wait for trial expiry rather than unexpectedly losing free days. Stripe Checkout explicitly discloses its payment and renewal schedule. Card collection and later automatic conversion happen only when a manager elects to complete subscription checkout.

Workflow writes require a current provider subscription with active status, the configured plan/quantity/mode, and a current paid period, or an unexpired app trial. Past-due, unpaid, paused, incomplete, canceled and expired periods grant no paid editing access. Cancel-at-period-end preserves paid access through that period. Provider outages fail closed for routine writes while viewing, records/backup exports, access revocation and recovery remain available. Deletion refuses a still-running subscription; open checkout is expired before deletion. Minimal external billing/trial mappings survive deletion; do not mistake workspace deletion for full Stripe customer erasure.

Webhook event snapshots never grant access. Recognised events trigger authoritative subscription retrieval; duplicate receipts are idempotent and older snapshots cannot overwrite access. Every workflow access decision independently checks the provider, so no unordered event cache is used for entitlements. Event receipts contain ID, workspace reference, event type and receipt timestamp only; no card data or full event payload. Receipts older than 30 days are pruned during successful webhook receipt. Separate retention/deletion of minimum account mappings must be included in final business records policy. This initial design trades extra provider calls for fresh access decisions; assess latency and rate limits during sandbox acceptance before scaling.

## Native runtime configuration — key names only

Use Sites production environment settings to enter secrets; never paste credentials into chat, source, command arguments, browser code or a hosting manifest.

- QUENVIRA_BILLING_MODE: disabled (default), test or live.
- STRIPE_RESTRICTED_KEY: rk_test_… in an isolated Stripe sandbox, or rk_live_… only after live approval. Minimum scoped permissions for customers read/write, Checkout Sessions read/write, prices read, subscriptions read, invoices read (including InvoicePayments), charges read for risk ownership, and Billing Portal Sessions write; validate the actual Stripe permission UI and API calls in the sandbox. No payout/transfer or bank-management access is needed.
- STRIPE_WEBHOOK_SECRET: secret of the matching sandbox/live endpoint.
- STRIPE_PRICE_ID: verified £19 total GBP monthly licensed Price with inclusive tax behavior.
- STRIPE_PORTAL_CONFIGURATION: approved Customer Portal configuration; cancellation at period end and payment method updates enabled, plan changes disabled for this one-plan release.
- QUENVIRA_SITE_ORIGIN: exact HTTPS deployment origin, no path/trailing slash.
- QUENVIRA_TERMS_VERSION: 2026-10-22, only after replacing the public draft with agreed live-ready terms for live use.
- QUENVIRA_SELF_SERVE: yes only when onboarding is authorised and tested. Missing value retains invitation-only creation.
- QUENVIRA_PAID_LAUNCH_APPROVED: yes is additionally required in live mode. Do not set merely to silence a check.

Webhook URL: same Site origin plus /api/quenvira/subscription-webhook. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.paid and invoice.payment_failed. Use the integration's pinned API version (2026-08-26.dahlia). A missing signing secret disables the endpoint; it never trusts missing signatures or the normal browser identity headers.

The currently connected Stripe tool exposes only the live CCS account. It does not give the hosted Worker a runtime key and cannot substitute for a sandbox or inject a key. Secure owner/provider credential provisioning and a test account connection are still required. Never create live chargeable objects as a substitute for sandbox tests.

## Acceptance still to perform with a real Stripe sandbox

1. Configure isolated sandbox key/price/portal/webhook and final test terms; keep public production billing disabled. Use a separate test deployment for credentials and test customers.
2. Enroll two test business identities and an assigned staff identity. Check no-card signup, fixed trial end, duplicate retries and terms acceptance.
3. Complete real sandbox Checkout including 3DS and asynchronous outcomes. Confirm hosted webhooks are reachable without ChatGPT sign-in but reject unsigned/tampered requests. If Sites dispatch disallows the provider request, stop: use supported hosting/service access rather than weakening authentication.
4. Use Stripe Test Clocks/provider test methods for first paid invoice, renewal, payment failure, recovery, cancel-at-period-end, cancellation expiry and duplicate/reordered deliveries. Observe both manager/staff workflow writes and read/export retention. Confirm one subscription per workspace and no cross-business portal access.
5. Complete the isolated hosted recovery drill in OPERATIONS.md. The new operator full-store backup includes subscription mapping/event tables in v2 and accepts legacy v1 business snapshots; old v1 snapshots do not reconstruct missing external billing mappings. A manager .qvb backup intentionally excludes subscriptions and memberships. Reconcile the Stripe customer mapping before granting paid access after migration to a different Site identity namespace.
6. Confirm VAT status, supplier invoice settings, provider/DPA particulars and final terms. Then document approval, provision live scoped credentials and the approved live product/price/portal/webhook, run live acceptance permitted by the owner, and separately enable self-service. No live charge or spend was authorised by this preparation.

## Evidence and limits

177 automated tests passed after implementation, including 11 new subscription integration cases, two client billing cases and legacy/operator recovery coverage. Real SDK signature generation/verification is used for webhook tamper/replay/tolerance tests; payment responses are controlled fakes, not real sandbox transactions. Syntax and TypeScript checks passed; production build passed. The managed preview supervisor reported running, but the browser connection to terminal.local:4173 was refused; fresh browser acceptance of this change is unverified. Existing user-reported device acceptance applies to earlier workspace paths only.

Official references checked 22 October 2026:
- https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/customer-management/integrate-customer-portal
- https://www.gov.uk/invoicing-and-taking-payment-from-customers/invoices-what-they-must-include
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/what-needs-to-be-included-in-the-contract/

No legal/tax/hosted recovery or commercial acceptance certification is claimed.

Current operation identifiers and the hosted 403 diagnosis are in [STRIPE_RESTRICTED_KEY_DIAGNOSIS.md](launch/STRIPE_RESTRICTED_KEY_DIAGNOSIS.md). The historical request does not yet prove which grant the runtime key lacks; inspect its exact Workbench entry before changing access.
