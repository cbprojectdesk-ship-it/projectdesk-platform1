# Engineering release status — 20 October 2026

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
