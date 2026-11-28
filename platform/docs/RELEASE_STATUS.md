# Quenvira engineering release status

## Current release candidate — 28 November 2026

Status: **engineering release candidate for isolated review and private staging; NO-GO
for commercial launch or real customer data.** Reviewed code head
`0fda90599177bce44bc05df6a538d21eec64e674` on
`feature/quenvira-launch-preparation-2026-11-22`; base integration tree `526f0cf`.

Verified on that tree:

- Platform suite: **320 passed, 0 failed, 0 skipped**. Root demonstration: **59 passed**.
- Syntax, ESLint and TypeScript checks passed; production build passed.
- `npm run db:verify`: five migrations, eleven required tables, foreign-key and quick
  checks OK.
- Chromium browser acceptance: **96 passed** across 1440, 360, 390 and 768 widths.
- Production-dependency audit: no known vulnerabilities. Full audit: one moderate
  development-only `minimatch` advisory; no high or critical.
- Built Worker probes: nonce CSP on `/`, strict CSP on static workspace HTML, baseline
  and CSP on 404/redirect responses, baseline headers on the unauthenticated API, and
  cross-origin MCP rejection.

Changes reviewed in this cycle: the MCP browser origin check now rejects external
`Origin` and `sec-fetch-site: cross-site` requests before identity or queue access; the
session exposes the configured plan terms version/URL and workspace setup no longer uses
the stale 28 October default; non-static Worker responses receive the baseline headers
and an HTML CSP while the body-less Vinext static hand-off is left alone. The durable
invoice outbox, leases, retry boundary, provider idempotency and suppression paths were
reviewed with no new delivery defect found.

Still open: hosted identity stripping/private origin; independent human review; hosted
D1/R2 migration and isolated recovery; authorised Stripe test-mode lifecycle; approved
Resend recipient delivery/bounce/complaint evidence; monitoring and on-call ownership;
legal/privacy/commercial approval; Firefox/WebKit/physical-device/assistive acceptance.
No deployment, production migration, live billing, customer email, DNS, secret, schedule
or public-indexing change was made. See
`launch/RELEASE_CANDIDATE_2026-11-28.md` for the full evidence and owner decisions.

The material below is retained as historical evidence and is superseded by this section.

## Historical engineering status — 20 October 2026

Status: private server-backed development release. Do not label production-ready.

Verified locally:

- 81 automated tests: 56 preserved demo tests, 20 API/SQLite tests, five client/API integration tests.
- Actual generated SQL migrations execute against SQLite with foreign keys enabled.
- Anonymous access, cross-business reads/writes/backups, same-origin enforcement, oversized bodies, worker privacy, invitations/expiry/revocation, stale writes, replay, database rollback, recovery restoration, deletion and rate limits are tested.
- Current UK-local dates replace the fixed clock in server operations; future work cannot start early.
- Application syntax and TypeScript checks pass.
- Patched framework production build passes.
- Production-dependency audit: zero known advisories. Full development audit: one unpatched high-severity advisory, `braces` 3.0.3, used by developer glob/build tooling. No untrusted project/glob compilation is provided by the product.

Security boundary: production identity is injected by Sites dispatch. Unit tests simulate these trusted headers; they do not prove dispatch stripping or hosted authentication end-to-end. Keep the origin private and preserve platform sign-in integration.

Remaining before real-data/customer release:

1. Real-browser and device acceptance, including native dialogs/form constraints/downloads, accessibility, 360/390/768/1440-pixel layouts and browser compatibility. Supported browser tooling was unavailable in the authoring environment.
2. Hosted identity, D1 persistence and multi-user account verification. Deployment success alone does not prove these flows.
3. Independent encrypted backups and restoration after database loss; current revision history shares the same failure domain.
4. Monitoring, alerting, documented incident ownership and rollback/recovery exercises. The API fails closed and hides internal errors but no operational response service is configured.
5. Invoice supplier/legal profile, compliant invoice issue/credit-note lifecycle, retention/data-subject processes, controller/processor contracts, privacy notice and business contact details. Draft invoices cannot be sold as compliant tax invoices.
6. Production recurrence lifecycle (pause/skip/change-future), staff access pilot and capacity/scale validation beyond the small aggregate limit.
7. Owner approval before spending, customer outreach, contracts or a paid launch. No such actions are performed by this release.

The starter security versions were updated from Next 16.3.4 to 16.3.8 and React/RSC 19.2.6 to 19.2.8, alongside patched transitive dependencies. Advisory references include https://github.com/advisories/GHSA-vcvr-r3jv-pc5j and https://github.com/advisories/GHSA-wx67-qw84-cm4g . The remaining developer-only issue is https://github.com/advisories/GHSA-vfj7-8cjw-p6xm .

## Later verification update

The earlier 81-test count above is historical. The platform suite now has 114 cases, including three added synthetic disaster-recovery cases. All passed locally on 20 October 2026. Thirty separate cross-browser cases passed on GitHub for PR #8 (five scenarios in six browser/viewport projects). A new encrypted operator recovery module and Help page are being checked as a follow-up; exact PR-head checks must pass before merging. Hosted identity, actual-device and independent D1 recovery gates remain open.

## Development update — 22 November 2026

Current verified development branch: `feature/quenvira-launch-preparation-2026-11-22`,
based on the verified PR #52/#60 integration tree.

- Platform suite: **316 passed, 0 failed**; root demonstration: **59 passed**.
- Syntax, ESLint, TypeScript and production build pass.
- Chromium browser acceptance: **96 passed** across desktop, 360px, 390px and 768px.
- Added durable failed-command throttling (`drizzle/0004_command_attempts.sql`); the
  121st authenticated command attempt in a minute returns `429`, including commands that
  never commit.
- Added baseline HTTP security headers via `server/security-headers.mjs`, `next.config.ts`
  and a nonce/self-only CSP in `proxy.ts`; verified on the local built Worker.
- Malformed, wrong-content-type and oversized command bodies now count toward the
  failed-command limit.
- Optional HMAC identity proof (`QUENVIRA_IDENTITY_PROOF_SECRET`) is available but not
  enabled until the hosting proxy contract is verified.
- `command_attempts` is covered by readiness and operator recovery snapshots.
- Added strict validation of managed identity headers; malformed identities fail closed.
- Production dependency audit is clean. Full audit retains one moderate development-only
  `minimatch` advisory.
- See `launch/LAUNCH_READINESS_REPORT_2026-11-22.md` for blockers and the recommended
  launch sequence.

This update does not prove hosted identity, D1/R2 recovery, Stripe, Resend, monitoring,
legal readiness or production deployment.
