# Final launch acceptance — 30 October 2026

Status: NOT READY for paid public onboarding. No live billing, customer invoice sending, owner backup/download, audience change or production data mutation is part of this update.

## Reconciled managed-host candidate

The actual managed-host source is `9738e6ce02eb68c3d3795e08617c332be8683d24`, version 57. The GitHub main tree is not a replacement for its hosting configuration. `MANAGED_HOST_CANDIDATE_2026-10-30.patch` applies to that exact source (verified with `git apply --check`). SHA-256: `9e6c68bb0d98cec8d80c07fc88b8a0bee48786750197695fb9468fe48fa44bcf`.

The patch reconciles this PR's staff access, bounded diagnostics, test acknowledgement, backup verifier and dependency fixes with the hosted source. It excludes the standalone-only Access adapter and its tests. It preserves the actual hosting manifest, D1/R2 bindings, managed sign-in, Worker adapter, source project and existing pilot billing configuration. No SQL migration is included. This is reviewable source, not a deployment or backup.

Validation: 284 managed-candidate Node tests passed (zero failures, skips or cancellations); production build and full ESLint passed. The corresponding GitHub platform changes passed 294 Node tests, including the ten standalone Access tests. Historical browser CI on the earlier PR head is not evidence that the new head passed CI.

## Draft terms and five-band checks

Draft terms version 2026-10-30 now distinguishes active profiles from retained inactive history. Plan allowances include the owner: Solo 1, Team 5/10/15/20 people at GBP 7.99/14.99/24.99/32.99/39.99 monthly. The added server regression exercises all five boundaries, rejects an extra active profile atomically, and preserves history/exports while allowing deactivation to recover from an over-limit downgrade. Existing independent-sign-in race and tenant-isolation tests remain.

The proposed commercial policy is immediate prorated upgrades with an unchanged billing date, cheaper-plan changes at period end, and period-end cancellation. These remain drafts requiring owner approval and hosted/provider acceptance. Updating source does not retrospectively accept terms for any business. The legacy pilot terms/runtime remain unchanged.

Provider reads reconfirmed the existing five sandbox prices and matching expired unpaid Checkout sessions; no new payment sessions, customers, subscriptions or test clocks were created for that check. A separate non-default sandbox portal configuration was created for these five prices, immediate upgrade invoices, scheduled cheaper plans and period-end cancellation. The current pilot portal was left unchanged. The provider rejected the preview-only open-invoice restriction parameter; it is not configured. Do not claim portal open-invoice blocking is proven. Server entitlement still requires a settled invoice.

## Remaining gates

- Genuine independent repository review: connected GitHub identity is the author. No self-approval, bypass, merge or public deployment.
- Restricted runtime key lacks Charges Read, required by charge lookup in risk-event reconciliation. Invoices Read was added and the owner's rotated restricted sandbox key was installed securely; hosted subscription reads and sandbox portal session creation passed. No full-access key is installed. Further permission expansion requires action-time owner approval. Earlier restricted-key expiry is not yet verified.
- Hosted five-band signed-provider acceptance, actual staff identity testing, proration/downgrade/cancellation/renewal/recovery acceptance. Passing local SDK transport tests does not prove provider delivery. The existing owner-private recovery site cannot receive unauthenticated Stripe webhook delivery through its audience gate; do not widen it silently.
- Controlled hosted email retry/missed-run/bounce/complaint acceptance. Local synthetic recovery/idempotency tests pass, and prior genuine CCS enquiry delivery is evidenced; real customer invoice sending remains off.
- Supported consistent complete managed database/object export and isolated restoration. Bounded table reads are not a consistent export. The existing synthetic recovery destination contains records; do not overwrite it or call it empty.
- Owner approval of final commercial terms and later separate live activation. No legal or regulatory compliance certification is claimed.

Phone inventory and deferred owner encrypted-backup/download instructions are in the private CCS continuation report. Do not publish a pending number or export production secrets.
