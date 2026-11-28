# Final launch acceptance — 30 October 2026

Status: NOT READY for paid public onboarding. No live billing, customer invoice sending, owner backup/download, audience change or production data mutation is part of this update.

## Reconciled managed-host candidate

The actual managed-host source is `9738e6ce02eb68c3d3795e08617c332be8683d24`, version 57. The GitHub main tree is not a replacement for its hosting configuration. `MANAGED_HOST_CANDIDATE_2026-10-30.patch` applies to that exact source (verified with `git apply --check`). SHA-256: `49d1b4b69dbfc9632aabf8180b36d7bf334f6bc72c37a1a89187892f40172981`.

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


## Recovery concurrency correction — 31 October 2026

Supersedes the managed candidate test count above: 288 tests passed, zero failed/cancelled/skipped, after four new recovery regressions. Snapshot reads now share a SQLite savepoint; rollback/release preserves an outer caller transaction. Restore requires its own connection outside a transaction and obtains BEGIN IMMEDIATE before checking target emptiness, preventing a concurrent writer from invalidating that check. Tests use disposable fictional SQLite files and a second concurrent connection. No production export, encrypted owner backup or hosted restore was performed.

The rebuilt managed candidate passed production build, syntax and git diff --check; full ESLint exited zero with two pre-existing image warnings. The regenerated patch applies cleanly to pristine managed baseline 9738e6ce02eb68c3d3795e08617c332be8683d24, SHA-256 49d1b4b69dbfc9632aabf8180b36d7bf334f6bc72c37a1a89187892f40172981. This patch preserves managed identity/storage configuration and contains the pending hardening plus recovery correction. Fresh GitHub CI on the new head must finish; earlier-head results are historical. Full managed D1/R2 export and isolated restore acceptance remain unverified.

Independent review request #56 remains open and unassigned. No human approval, merge, deployment, secret/permission change, production/customer email or live billing is authorised by this correction.


## 4 November prelaunch correction (supersedes older candidate details)

The hosted clash check reproduced a misleading status: discarding a rejected booking left “Changes not saved” visible. Closing a definitely rejected form now resets the status, while uncertain writes keep their warning and idempotent retry requirement. A regression tests rejected overlap, cancelled discard, confirmed discard, lost-response protection and replay without duplicate records.

Prepared public/privacy and business schedule copy now matches Solo £7.99 / Team 5 £14.99 / Team 10 £24.99 / Team 15 £32.99 / Team 20 £39.99, includes the owner in allowances and uses https://ccscreativetech.co.uk. The old £19 mapping is identified as historical sandbox configuration. No commercial policy has been approved by these edits.

Managed candidate source: a6d1c6b3ea978db320c6aea9843b412355501b78. Complete 289-test suite passed with zero failures/skips/cancellations; focused UI suite 43 passed; lint, type checks, syntax and production build passed. Two pre-existing image lint warnings remain. The patch above applies cleanly to exact managed baseline 9738e6ce02eb68c3d3795e08617c332be8683d24, preserving its hosting identity and bindings. Patch SHA-256: 47ffb7d28da9140231bb7ed59a5a724a62e145e10dfe54535c94898f948ca611.

The managed candidate is saved without deployment. Actual hosted acceptance still runs 4b669f3fe0dfaecede6e50b4a819205c2d54a6cb, environment revision 3. Fresh hosted evidence: recurring fictional zero-value visits persisted; overlapping booking rejected without revision advance. This is single-owner testing, not independent staff acceptance or hosted verification of the new status correction.

Historical GitHub CI on predecessor a024bf1 passed 298 platform tests and 144 browser cases. Those are retained evidence for unchanged paths; new-head CI must be inspected separately, and fresh actual hosted smoke is required after any later approved deployment. The dependency audit result is dated 31 October, not a fresh full/development audit.

Independent review of this updated head, independent authenticated testing, hosted five-band provider/email failure acceptance, full consistent D1/R2 recovery and final commercial particulars remain open. The isolated host lacks a dedicated Stripe webhook signing secret/endpoint and email credentials; do not enable billing/email with partial configuration or make it public to obtain callbacks. No merge, deployment, registration, live billing, real-customer email or final owner encrypted download is authorised by this note.
