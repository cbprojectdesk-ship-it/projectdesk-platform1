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
- Fresh signed-in manager/staff and second-business browser acceptance remains unverified. Preview supervision failed because another Vinext server is already running; no alternative browser automation or identity bypass was introduced.
- Independent encrypted owner backup and isolated hosted restore remain open. Native D1 inspection truncates workspace/history documents, so those responses cannot be used as a complete backup. No live workspace was deleted or overwritten for a drill.
- Successful receipt of an enquiry beyond FormSubmit's CAPTCHA remains unverified.
- VAT treatment, provider/data-processing particulars and final commercial terms need factual owner confirmation before collecting real subscriptions. Automatic tax and live billing remain off; no paid service or legal agreement was activated.

## Validation

Hosted candidate: 186 automated tests, syntax, TypeScript and production build. Repository: 194 automated tests after preserving its additional regressions. Public HTTP verification and exact published version are recorded after deployment below. Browser, physical-device and hosted disaster-recovery limitations above are explicit.
