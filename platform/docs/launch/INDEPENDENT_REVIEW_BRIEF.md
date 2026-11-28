# PR 52 — independent review briefing

Review baseline: application head `07a9865`, based on main `47d4eda`. This briefing is preparation, not an independent approval. Documentation follow-ups must be distinguished from the tested application baseline.

## Scope and evidence

The PR adds reversible staff deactivation/access revocation, bounded Stripe error attribution, test-only enquiry acknowledgements, offline backup verification, dependency security patches and release preparation. Website copy is internal only. No database migration is included. No production deployment, live billing, customer email or payment is performed by these changes.

Baseline evidence: 293 platform tests and 144 browser tests passed; five CI workflows succeeded. Lint, syntax, TypeScript and production build passed. Full platform and browser lockfile audits returned zero known advisories after targeted patches. A synthetic renderer compatibility check and exact-UTF-8 backup CLI check passed. The complete 54-file baseline diff was checked for credential patterns; no matches were found. These bounded checks are not a guarantee of no vulnerabilities, independent identities or hosted acceptance.

## Review focus

| Area | Review questions |
| --- | --- |
| Staff access: `server/api.mjs`, `server/domain.mjs`, `server/plans.mjs` | Are deactivation and link/membership revocation limited to the winning manager revision? Do stale commands/database failures leave access consistent? Are inactive/orphan staff denied, open visits protected and history retained? Does reactivation require fresh links and valid entitlements? |
| Maintenance and email: `server/email-background.mjs` | Can access-removal maintenance run during expiry/provider failure without activating staff, changing unrelated data or waking queued email? |
| Billing: `server/subscriptions.mjs`, `server/stripe-diagnostics.mjs` | Are tenant ownership, authoritative settlement and signed-event replay guards preserved? Are diagnostics limited to fixed operation/permission labels and bounded fields? No free-form provider messages or secrets should reach logs. The runtime 403 is still unresolved. |
| Enquiries: `server/website-enquiries.mjs` | Is acknowledgement strictly test-gated/allowlisted with separate idempotency, durable acceptance/uncertainty and a preserved sending budget? No unapproved production recipient should become reachable. |
| Backup: `scripts/verify-business-backup.mjs` and tests | Does offline validation authenticate bytes and all photo references without connecting to production? Does CLI input preserve Unicode/whitespace without echoing passwords? Windows device verification remains outstanding. |
| Toolchain: package manifest, workspace policy and lockfile | Are the Vite/Undici/Satori patches targeted, compatible and covered by build/renderer checks? Release-age and allowed-build controls must remain intact. |
| Public material | Confirm no actual credentials/private inventory, no accidental live offer/checkout, and no unrelated application change. Generic configuration examples are deliberately incomplete. |

## Approval boundary

An eligible reviewer must use their own GitHub identity and the normal PR review controls. The connected identity is the PR author and cannot supply independent approval. No eligible reviewer is identified in the available access; the repository administrator must select an authorized collaborator (or grant a trusted reviewer the role required by existing rules) and request review on PR 52. Do not create a substitute reviewer, dismiss legitimate findings or enable administrator bypass.

After findings are resolved and required checks/approvals pass, follow `DEPLOYMENT_AND_RECOVERY_HANDOFF.md`. Mergeability alone does not authorize merging or establish hosted compatibility. Genuine independent-user acceptance is specified separately in `INDEPENDENT_ACCOUNT_ACCEPTANCE.md`.
