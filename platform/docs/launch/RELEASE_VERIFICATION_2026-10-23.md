# Release verification — 23 October 2026

## Confirmed against current services

- CCS version 7 contains the requested gold border (#E5A900), cream background (#FFF4C9) and gold button (#F5BE30). The published stylesheet returned all three exact colours.
- Quenvira Sites version 29 successfully deployed at source efc4ad6969fe7ded4313d7f432139fc0b7f5fa1b. This includes trial/cancellation status and duplicate-checkout controls.
- The configured Stripe connection and runtime remain sandbox-only; public self-service remains off.
- The owner's sandbox Checkout Session is complete with required terms accepted. Its exact customer and session IDs match the live D1 subscription_accounts row. D1 contains the matching subscription-created, checkout-completed, invoice-paid and cancellation-updated receipts. This supersedes earlier claims that checkout completion or mapped webhook receipt was wholly unverified.
- That subscription is trialing and scheduled to cancel at its original trial end on 5 November. No real payment was taken. The amount-zero trial invoice does not prove a paid renewal.
- In a separate named fictional test-clock customer, the £19 monthly plan created an active sandbox subscription using Stripe's Visa test method. Scheduling period-end cancellation retained active status; immediate cancellation then returned canceled.
- In a second fictional customer, Stripe's chargeCustomerFail test method produced an incomplete subscription. The test subscription was cancelled and returned incomplete_expired. Test customers have no email, and were not linked to or enrolled into the owner workspace.
- Both disposable subscriptions are terminal; no test subscription was left cycling. Their single simulation expires automatically. The connector exposes clock creation but no clock advancement/deletion operation, so timed renewal and dunning/recovery were not certified.
- Public anonymous session requests returned 401. Prior and current unsigned webhook checks must return 400; no identity-header bypass was used.
- PR #33 merged successfully after its three GitHub checks passed.

## Changes in this release

A public read-only /api/quenvira/health readiness check verifies D1 schema, R2 availability and complete runtime billing configuration, returning only ok/unavailable. It reads no business rows and exposes no credentials, identifiers or provider errors. Writes to it are rejected.

The repository now preserves the already-hosted subscription status/cancellation and completed-checkout restart guards with their regressions. An hourly GitHub Actions workflow checks both public sites, gold CSS, demo, storage readiness, anonymous-access denial, unsigned-webhook rejection and terms availability. It needs no secrets, writes no business data, and has manual dispatch. Failed runs are visible in GitHub Actions; delivery of account notification emails has not been verified. This is hourly monitoring, not a 24/7 response service or an uptime guarantee.

## Remaining evidence requiring supported owner access

- Real provider timed renewal, failure retry and recovery require advancing the Stripe sandbox simulation; this connector does not expose that operation. Hosted business entitlement across those transitions remains unverified.
- Owner confirmed the signed-in account checks completed on 23 October, following the earlier screenshots/mobile stacking checks. See OWNER_ACCEPTANCE_2026-10-23.md. The replacement extended browser run passed all 114 tests; the earlier installation-only run was cancelled.
- Hosted synthetic business-data restore passed using an independent encrypted file and actual isolated D1/R2 storage; see HOSTED_RECOVERY_2026-10-23.md. The owner real backup is explicitly deferred to laptop access with an evening reminder. No live workspace was deleted or overwritten.
- Enquiry receipt is evidenced by actual FormSubmit emails in the business Gmail Trash dated 21 October. The activated hashed form endpoint is unchanged since that date. This is historical preview-origin receipt evidence, not a fresh post from today’s published origin.
- Owner confirmed CCS is not UK VAT registered. Published draft terms and commercial preparation reflect £19 total monthly with no VAT added. See COMMERCIAL_PREPARATION_2026-10-23.md for remaining per-customer processing/order particulars. Automatic tax and live billing remain off; no paid service or legal agreement was activated.

## Validation

Hosted candidate: 186 automated tests, syntax, TypeScript and production build. Repository: 194 automated tests after preserving its additional regressions. Public HTTP verification and exact published version are recorded after deployment below. Browser, physical-device and hosted disaster-recovery limitations above are explicit.
