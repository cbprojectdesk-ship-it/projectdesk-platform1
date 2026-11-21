# Quenvira AI-assisted technical assurance — 21 November 2026

This report was prepared by an AI agent (OpenHands) on behalf of CCS Creative Technologies. It is **not** independent human review, human certification, legal advice, a DPO opinion or formal compliance certification. It does not satisfy issue #56's request for an independent human reviewer.

## Scope and independence limitation

The review covered:

- PR #52 at `a1e189f9ff1b93050155e932d4e846ead882f7d3` (rate-limit fix).
- PR #60 at `6daaedc1e36060c7172f3a8f08b57df9d316c827` (code head `340f016`).
- The combined integration branch at `bdb23cd1ca19897891e1c6e4d0547ed6e3795ef6`, whose verified code tree is merge commit `b011f96942819e4cc128830526f5a7ea95ae9e15`.
- PR #61 at `5571cebab52e3b0915ca1314ebbdd16f1cbec890` as the security-only fallback.

Fresh worktrees were used at the exact commits (`/tmp/q52sec`, `/tmp/qa60`, `/tmp/qa-review`), with the platform suite, syntax checks, TypeScript, lint, production build, dependency audits and an independent adversarial probe script. The same OpenHands model previously participated in implementation. No separate review agent was available in this environment. This is therefore **fresh-context AI assurance**, not organisational or human independence.

## Approval requirement: origin and enforcement

Issue #56 was created on 31 October 2026 by the repository owner, `cbprojectdesk-ship-it`. Its body says CCS Creative Technologies requests a "genuinely independent, authorised code review" and that the connected repository author cannot serve as independent approver. It is a request to repository collaborators/maintainers.

No law, contract, DPA or platform term was found that requires an independent human code review before an invitation-only **fictional-data** pilot. Legal/DPA/DPIA/ICO and consumer-law work remains necessary before real personal data or paid service, but that is a data-protection and commercial obligation, not a code-review rule.

`main` is protected (`protected: true`). GitHub rulesets are empty and no CODEOWNERS file exists. The available integration token cannot read the exact classic branch-protection settings (`403 Resource not accessible by integration`). All three PRs report `mergeStateStatus: CLEAN`, `reviewDecision` empty and zero review requests, so **no platform-enforced approving-review gate is observable**. CI status checks are enforced and green. The exact protection rule is **NOT VERIFIED**.

Conclusion: the independent human approval requirement is **owner-imposed**, not legal or contractual. A platform merge protection exists, but no approving-review rule is currently observed. The owner may authorise a fictional-data pilot without an external human code review, subject to the conditions and residual risks below. The owner must not describe AI assurance as human certification.

## Deployment status

- `quenvira.ccscreativetech.co.uk` does not resolve (NXDOMAIN).
- `ccscreativetech.co.uk/quenvira/` is a public marketing/early-access page; no sign-in, checkout, Stripe or workspace.
- `ccscreativetech.co.uk/quenvira-demo/` is the public static fictional demo with `connect-src 'none'`; it has no backend.
- `/api/quenvira/health` and `/workspace.html` return 404.
- GitHub has no deployments, environments, Pages site or releases. `deploy-staging.yml` is validation-only and leaves deployment disabled.
- No live customer application, database, Stripe webhook, Resend production path or customer data was found.

## Verified evidence

| Area | Result | Evidence |
| --- | --- | --- |
| #52 platform suite | **PASS** | 303/303; `npm run check`; `tsc --noEmit`; lint; production build |
| #60 platform suite | **PASS** | 286/286 at the PR head; 313/313 on the rebased candidate |
| Combined platform suite | **PASS** | 313/313; `npm run check`; `tsc --noEmit`; lint; build |
| Combined browser suite | **PASS** | CI 44956492561: 144/144 Chromium/Firefox/WebKit, desktop/360/390/768 |
| #60 browser suite | **PASS** | CI 44957160127: 138/138 |
| Production dependency audit | **PASS** | `pnpm audit --prod --audit-level high`: no known vulnerabilities on #52, #60, #61 and combined |
| Full dependency audit | **PASS with one moderate** | #52/combined/#61: 1 moderate dev-only `minimatch`; #60 retains five high dev-toolchain advisories until #52 lands |
| RSC/Next advisory | **PASS** | React/RSC 19.2.9, Next 16.4.6; `dist` 0 × 19.2.8 and 14 × 19.2.9 |
| Failed-command throttling | **PASS** | Persistent `command_rate_limits` counter; 121st valid command attempt in a minute returns 429; stale, invalid and unauthorised attempts count; recovery remains available |
| Anonymous access | **PASS** | `/session` and workspace creation return 401 without identity |
| Cross-tenant isolation | **PASS** | Cross-tenant read, command, export and delete return 404; other tenant remains readable |
| Staff projection | **PASS** | Assigned jobs only; no price, invoice id, supplier, customer email or other staff; unassigned jobs hidden |
| SQL/HTML payload handling | **PASS** | SQL injection string stored as data; `workspaces` table intact; XSS payload stored and escaped by the existing UI tests |
| Stale revision / idempotency | **PASS** | Stale revision 409; reused key with different payload 409; first command preserved |
| Deletion | **PASS** | Exact manager confirmation; wrong name 400; other tenant 404; tenant rows removed; other business intact |
| Backup integrity | **PASS** | Tampered backup rejected; authentic encrypted backup restores into empty workspace; existing tests cover wrong key, missing photo, nonempty target and storage failure |
| Invoice accuracy | **PASS** | 20% VAT on £78.99 produces £94.79; issued snapshot locks against later edits and re-issue |
| Permissions / revocation | **PASS** | Staff manager routes 403; invitation revocation and commit-time authority recheck covered by suite |
| Failure handling | **PASS** | DB failure rollback, stale revisions, malformed JSON, oversized bodies, provider outage fail-closed and recovery paths covered |
| Webhook/email security | **PASS (code)** | Stripe/Svix signature tests, dispatcher constant-time token, recipient suppression, idempotency and bounce handling |
| Secret scan | **PASS** | No live-looking keys in tracked source; only `.env.example` placeholders |
| Public enquiry endpoint | **PASS (code)** | Fixed recipient/sender, origin allowlist, honeypot, validation, quota and idempotent provider calls |

## Confirmed gaps and unverified dependencies

### PASS — failed-command throttling

PR #52 now adds a persistent `command_rate_limits` D1 table keyed by workspace and user. Every valid command attempt increments the current minute before revision, permission or domain processing, so invalid, stale and unauthorised commands count. The 121st attempt in a minute returns 429. Idempotent replays are checked first and still return the original response. `backup.import`, `backup.restore` and staff deactivation remain available for recovery even when the limit is reached.

Regression tests cover failed commands, recovery, idempotent retries, per-user/workspace isolation and persistence. Malformed JSON or unsupported content types are rejected before the counter and remain an edge/WAF concern.

### NOT VERIFIED — external dependencies

- Managed Sites identity-header overwrite or Cloudflare Access at the production edge, with manager MFA/session/revocation evidence. The session endpoint reflects the supplied platform email header; the standalone guard strips caller identity headers, but the real hosting boundary is not deployed or verified.
- Real Stripe sandbox/live acceptance: checkout, renewal, failed payment, cancellation, refund/dispute, webhook reachability and `charge_read`.
- Independent encrypted D1/R2 backup, key custody and isolated restore drill. Synthetic encrypted backup tests pass.
- Approved Resend customer sending, bounce/complaint handling and retry evidence.
- Production monitoring, alerting, rollback drill and incident ownership.
- Exact GitHub classic branch-protection rule (token lacks permission).
- Legal/DPA/DPIA/ROPA/ICO/VAT review and retention/deletion policy.
- HTTP security headers: `platform/next.config.ts` is empty; the public demo has its own CSP, but the hosted app's edge headers are not verified.

## PASS / FAIL / NOT VERIFIED summary

- **PASS:** code-level authentication, tenant isolation, staff projection, permissions, deletion, backup integrity (synthetic), invoice accuracy, injection handling, dependency security, failed-command throttling, failure handling and the full automated suites.
- **NOT VERIFIED:** real hosting identity, Stripe, Resend, independent D1/R2 backup, monitoring/rollback, exact branch protection, legal/compliance and HTTP security headers.
- **NOT READY** for real paying customers or real personal data.
- **CONDITIONAL PASS** for an invitation-only fictional-data pilot, if the owner signs the acceptance statement and the conditions below are met.

## Pilot conditions

1. Fictional or synthetic records only; no real customer, staff, payment or special-category data.
2. Invitation-only access; no public sign-up or marketing claim of live service.
3. Billing mode `test`, no live Stripe keys, no live checkout, no live invoices or customer email.
4. A controlled/private environment; no public deployment until the identity boundary is verified.
5. Edge/WAF remains recommended defence-in-depth; the application-level failed-command limiter is implemented and tested.
6. Named incident contact, stop conditions, and deletion of pilot records at the end.
7. No claim of human review, certification, legal compliance or production readiness.

## Integration readiness

- **#52** `a1e189f` is the first merge candidate; it contains the RSC/Next patch, the persistent failed-command limiter and 303/303 tests.
- **#60** `6209ae2` (code `340f016`) follows after rebasing onto updated `main`; the prepared rebased candidate passes 313/313 platform tests and 144/144 browser tests in CI.
- **#61** `5571ceb` remains the security-only fallback if a build from `main` is ever deployed first.
- The rebased candidate has a clean production audit; full audit retains one moderate dev-only `minimatch` finding.
- No merge, deployment, live billing, customer email or credential change was performed.
